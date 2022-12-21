/*
*                      Copyright 2022 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

import { BuiltinTypes, ElemID, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import { FlatDetailedDependency } from '@salto-io/adapter-utils'
import formulaDepsFilter from '../../src/filters/formula_deps'
import { defaultFilterContext } from '../utils'
import { FilterWith } from '../../src/filter'
import { formulaTypeName, Types } from '../../src/transformers/transformer'
import { FIELD_TYPE_NAMES, FORMULA, SALESFORCE } from '../../src/constants'

const depNameToRefExpr = (typeName: string, fieldName: string|undefined = undefined): FlatDetailedDependency => {
  const additionalParams = fieldName ? [fieldName] : []
  const refExpr = new ReferenceExpression(new ElemID(SALESFORCE, typeName, fieldName ? 'field' : undefined, ...additionalParams))
  return {
    reference: refExpr,
  }
}

describe('Formula dependencies', () => {
  let filter: FilterWith<'onFetch'>
  let typeWithFormula: ObjectType

  beforeAll(() => {
    filter = formulaDepsFilter({ config: defaultFilterContext }) as FilterWith<'onFetch'>

    typeWithFormula = new ObjectType({
      elemID: new ElemID(SALESFORCE, 'Account'),
      annotations: { apiName: 'Account', metadataType: 'CustomObject' },
      fields: {
        someField__c: {
          refType: BuiltinTypes.STRING,
        },
        someFormulaField__c: {
          refType: Types.formulaDataTypes[formulaTypeName(FIELD_TYPE_NAMES.CHECKBOX)],
          annotations: {
            [FORMULA]: 'ISBLANK(someField)',
          },
        },
      },
    })
  })

  describe('When the formula has a reference', () => {
    it('Should return the reference as a dependency', async () => {
      const elements = [typeWithFormula.clone()]
      await filter.onFetch(elements)
      // eslint-disable-next-line no-underscore-dangle
      const deps = elements[0].fields.someFormulaField__c.annotations._generated_dependencies
      expect(deps).toBeDefined()
      expect(deps).toHaveLength(2)
      expect(deps[0]).toEqual(depNameToRefExpr(typeWithFormula.elemID.typeName))
      expect(deps[1]).toEqual(depNameToRefExpr(typeWithFormula.elemID.typeName, 'someField'))
    })
  })

  describe('Complex formulas', () => {
    const standardFormula = `IF(Owner.Contact.CreatedBy.Manager.Profile.Id = "03d3h000000khEQ",TRUE,false)
    && IF(($CustomMetadata.Trigger_Context_Status__mdt.by_handler.Enable_After_Insert__c ||
      $CustomMetadata.Trigger_Context_Status__mdt.by_class.DeveloperName = "Default"),true,FALSE)
    && IF( ($Label.Details = "Value" || Opportunity.Account.Parent.Parent.Parent.LastModifiedBy.Contact.AssistantName = "Marie"), true ,false)
    && IF( (Opportunity__r.Related_Asset__r.Name), true ,false)    
    && IF ( ( $ObjectType.Center__c.Fields.My_text_field__c = "My_Text_Field__c") ,true,false)    
    && IF ( ( $ObjectType.SRM_API_Metadata_Client_Setting__mdt.Fields.CreatedDate  = "My_Text_Field__c") ,true,false)    
    && IF ( ( TEXT($Organization.UiSkin) = "lex" ) ,true,false)    
    && IF ( ( $Setup.Customer_Support_Setting__c.Email_Address__c = "test@gmail.com" ) ,true,false)    
    && IF ( (  $User.CompanyName = "acme" ) ,true,false)`
    const processBuilderFormula = `IF([Account].Owner.Manager.Contact.Account.AccountNumber  = "text" ,TRUE,FALSE)
        || IF([Account].original_lead__r.ConvertedAccountId != "",TRUE,FALSE)
        || IF($CustomMetadata.Trigger_Context_Status__mdt.by_class.Enable_After_Delete__c , TRUE,FALse)`
    const standardFormulaExpectedRefs = ['salesforce.Account', 'salesforce.Account.field.LastModifiedById',
      'salesforce.Account.field.OpportunityId', 'salesforce.Account.field.Opportunity__c',
      'salesforce.Account.field.OwnerId', 'salesforce.Account.field.ParentId', 'salesforce.Center__c',
      'salesforce.Center__c.field.My_text_field__c', 'salesforce.Contact', 'salesforce.Contact.field.AssistantName',
      'salesforce.Contact.field.CreatedById', 'salesforce.Customer_Support_Setting__c',
      'salesforce.Customer_Support_Setting__c.field.Email_Address__c', 'salesforce.Details', 'salesforce.Opportunity',
      'salesforce.Opportunity.field.AccountId', 'salesforce.Opportunity__r',
      'salesforce.Opportunity__r.field.Related_Asset__c', 'salesforce.Organization',
      'salesforce.Organization.field.UiSkin', 'salesforce.Profile', 'salesforce.Profile.field.Id',
      'salesforce.Related_Asset__r', 'salesforce.Related_Asset__r.field.Name',
      'salesforce.SRM_API_Metadata_Client_Setting__mdt',
      'salesforce.SRM_API_Metadata_Client_Setting__mdt.field.CreatedDate', 'salesforce.Trigger_Context_Status__mdt',
      'salesforce.Trigger_Context_Status__mdt.field.DeveloperName',
      'salesforce.Trigger_Context_Status__mdt.field.Enable_After_Insert__c',
      'salesforce.Trigger_Context_Status__mdt.instance.by_class',
      'salesforce.Trigger_Context_Status__mdt.instance.by_handler', 'salesforce.User',
      'salesforce.User.field.CompanyName', 'salesforce.User.field.ContactId', 'salesforce.User.field.ManagerId',
      'salesforce.User.field.ProfileId']
    it('Should extract the correct references from a complex standard formula', async () => {
      const elements = [typeWithFormula.clone()]
      elements[0].fields.someFormulaField__c.annotations[FORMULA] = standardFormula
      await filter.onFetch(elements)
      // eslint-disable-next-line no-underscore-dangle
      const deps = elements[0].fields.someFormulaField__c.annotations._generated_dependencies
      expect(deps).toBeDefined()
      expect(deps).toHaveLength(36)
      expect(deps.map((refExpr: {reference: ReferenceExpression}) => refExpr.reference.elemID.getFullName()))
        .toEqual(standardFormulaExpectedRefs)
    })

    // Formulon doesn't support Process Builder formulas. See https://github.com/leifg/formulon/issues/935
    // eslint-disable-next-line jest/no-disabled-tests
    it.skip('Should extract the correct references from a Process Builder formula', async () => {
      const elements = [typeWithFormula.clone()]
      elements[0].fields.someFormulaField__c.annotations[FORMULA] = processBuilderFormula
      await filter.onFetch(elements)
      // eslint-disable-next-line no-underscore-dangle
      const deps = elements[0].fields.someFormulaField__c.annotations._generated_dependencies
      expect(deps).toBeDefined()
      expect(deps).toHaveLength(8)
      expect(deps.map((refExpr: {reference: ReferenceExpression}) => refExpr.reference.elemID.getFullName()))
        .toEqual(standardFormulaExpectedRefs)
    })
  })
  describe('CPQ formulas', () => {
    const simpleFormula = 'SBQQ__DistriBUtor__r.Name '
    const formulaWithUnknownRelationship = 'SBQQ__random__r.Name '
    const simpleFormulaExpectedDeps = ['salesforce.SBQQ__QuoTE__c',
      'salesforce.SBQQ__QuoTE__c.field.SBQQ__DistriBUtor__c',
      'salesforce.Account',
      'salesforce.Account.field.Name'].sort()
    const formulaWithUnknownRelationshipExpectedDeps = ['salesforce.SBQQ__QuoTE__c',
      'salesforce.SBQQ__QuoTE__c.field.SBQQ__random__c',
      'salesforce.SBQQ__random__r',
      'salesforce.SBQQ__random__r.field.Name'].sort()
    let typeWithCpqFormula: ObjectType

    beforeAll(() => {
      typeWithCpqFormula = new ObjectType({
        elemID: new ElemID(SALESFORCE, 'SBQQ__QuoTE__c'),
        annotations: { apiName: 'SBQQ__QuoTE__c', metadataType: 'CustomObject' },
        fields: {
          someField__c: {
            refType: BuiltinTypes.STRING,
          },
          someFormulaField__c: {
            refType: Types.formulaDataTypes[formulaTypeName(FIELD_TYPE_NAMES.CHECKBOX)],
            annotations: {
              [FORMULA]: '',
            },
          },
        },
      })
    })

    it('Should extract the correct references from a CPQ formula', async () => {
      const elements = [typeWithCpqFormula.clone()]
      elements[0].fields.someFormulaField__c.annotations[FORMULA] = simpleFormula
      await filter.onFetch(elements)
      // eslint-disable-next-line no-underscore-dangle
      const deps = elements[0].fields.someFormulaField__c.annotations._generated_dependencies
      expect(deps).toBeDefined()
      expect(deps.map((refExpr: {reference: ReferenceExpression}) => refExpr.reference.elemID.getFullName()).sort())
        .toEqual(simpleFormulaExpectedDeps)
    })

    it('Should extract the correct references from a CPQ formula with unknown relationship', async () => {
      const elements = [typeWithCpqFormula.clone()]
      elements[0].fields.someFormulaField__c.annotations[FORMULA] = formulaWithUnknownRelationship
      await filter.onFetch(elements)
      // eslint-disable-next-line no-underscore-dangle
      const deps = elements[0].fields.someFormulaField__c.annotations._generated_dependencies
      expect(deps).toBeDefined()
      expect(deps.map((refExpr: {reference: ReferenceExpression}) => refExpr.reference.elemID.getFullName()).sort())
        .toEqual(formulaWithUnknownRelationshipExpectedDeps)
    })
  })
})
