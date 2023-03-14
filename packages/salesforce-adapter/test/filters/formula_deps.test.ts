/*
*                      Copyright 2023 Salto Labs Ltd.
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

import {
  BuiltinTypes,
  ElemID,
  InstanceElement,
  ObjectType,
  PrimitiveType,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { FlatDetailedDependency } from '@salto-io/adapter-utils'
import formulaDepsFilter from '../../src/filters/formula_deps'
import { createCustomObjectType, defaultFilterContext } from '../utils'
import { FilterWith } from '../../src/filter'
import { createInstanceElement, formulaTypeName, Types } from '../../src/transformers/transformer'
import { FIELD_TYPE_NAMES, FORMULA, SALESFORCE } from '../../src/constants'
import { mockTypes } from '../mock_elements'

const depNameToRefExpr = (typeName: string, fieldName: string|undefined = undefined): FlatDetailedDependency => {
  const additionalParams = fieldName ? [fieldName] : []
  const refExpr = new ReferenceExpression(new ElemID(SALESFORCE, typeName, fieldName ? 'field' : undefined, ...additionalParams))
  return {
    reference: refExpr,
  }
}

const customObjectTypeWithFields = (name: string, fields: Record<string, PrimitiveType>): ObjectType => {
  const formattedFields = Object.entries(fields)
    .map(([fieldName, fieldType]) => [fieldName, { refType: fieldType }])
  const objectTypeFields = Object.fromEntries(formattedFields)
  return createCustomObjectType(name,
    {
      fields: objectTypeFields,
    })
}

describe('Formula dependencies', () => {
  let filter: FilterWith<'onFetch'>
  let typeWithFormula: ObjectType
  let referredTypes: ObjectType[]
  let referredInstances: InstanceElement[]
  let featureEnabledQuery: jest.SpyInstance

  beforeAll(() => {
    const config = { ...defaultFilterContext }
    featureEnabledQuery = jest.spyOn(config.fetchProfile, 'isFeatureEnabled')
    filter = formulaDepsFilter({ config }) as FilterWith<'onFetch'>

    typeWithFormula = createCustomObjectType('Account',
      {
        fields: {
          someField__c: {
            refType: BuiltinTypes.STRING,
          },
          someFormulaField__c: {
            refType: Types.formulaDataTypes[formulaTypeName(FIELD_TYPE_NAMES.CHECKBOX)],
            annotations: {
              [FORMULA]: 'ISBLANK(someField__c)',
            },
          },
          AccountNumber: {
            refType: BuiltinTypes.NUMBER,
          },
          OwnerId: {
            refType: BuiltinTypes.SERVICE_ID_NUMBER,
          },
          original_lead__c: {
            refType: BuiltinTypes.SERVICE_ID_NUMBER,
          },
          LastModifiedById: {
            refType: BuiltinTypes.SERVICE_ID_NUMBER,
          },
          OpportunityId: {
            refType: BuiltinTypes.SERVICE_ID_NUMBER,
          },
          Opportunity__c: {
            refType: BuiltinTypes.SERVICE_ID_NUMBER,
          },
          ParentId: {
            refType: BuiltinTypes.SERVICE_ID_NUMBER,
          },
          RecordTypeId: {
            refType: BuiltinTypes.SERVICE_ID_NUMBER,
          },
        },
      })
    const someCustomMetadataType = customObjectTypeWithFields('Trigger_Context_Status__mdt',
      {
        Enable_After_Delete__c: BuiltinTypes.BOOLEAN,
        Enable_After_Insert__c: BuiltinTypes.BOOLEAN,
        DeveloperName: BuiltinTypes.STRING,
      })
    referredTypes = [
      customObjectTypeWithFields('Contact',
        {
          AccountId: BuiltinTypes.SERVICE_ID_NUMBER,
          AssistantName: BuiltinTypes.STRING,
          CreatedById: BuiltinTypes.SERVICE_ID_NUMBER,
        }),
      someCustomMetadataType,
      customObjectTypeWithFields('User',
        {
          ContactId: BuiltinTypes.SERVICE_ID_NUMBER,
          ManagerId: BuiltinTypes.SERVICE_ID_NUMBER,
          CompanyName: BuiltinTypes.STRING,
          ProfileId: BuiltinTypes.SERVICE_ID_NUMBER,
        }),
      customObjectTypeWithFields('original_lead__r', { ConvertedAccountId: BuiltinTypes.SERVICE_ID_NUMBER }),
      customObjectTypeWithFields('Center__c', { My_text_field__c: BuiltinTypes.STRING }),
      customObjectTypeWithFields('Customer_Support_Setting__c', { Email_Address__c: BuiltinTypes.STRING }),
      createCustomObjectType('Details', {}),
      customObjectTypeWithFields('Opportunity', { AccountId: BuiltinTypes.SERVICE_ID_NUMBER }),
      customObjectTypeWithFields('Opportunity__r', { Related_Asset__c: BuiltinTypes.SERVICE_ID_NUMBER }),
      customObjectTypeWithFields('Organization', { UiSkin: BuiltinTypes.SERVICE_ID_NUMBER }),
      customObjectTypeWithFields('Profile', { Id: BuiltinTypes.SERVICE_ID_NUMBER }),
      customObjectTypeWithFields('RecordType', { Name: BuiltinTypes.STRING }),
      customObjectTypeWithFields('Related_Asset__r', { Name: BuiltinTypes.STRING }),
      customObjectTypeWithFields('SRM_API_Metadata_Client_Setting__mdt', { CreatedDate: BuiltinTypes.STRING }),
    ]
    referredInstances = [
      createInstanceElement({ fullName: 'Details' }, mockTypes.CustomLabel),
      createInstanceElement({ fullName: 'Trigger_Context_Status.by_class' }, someCustomMetadataType),
      createInstanceElement({ fullName: 'Trigger_Context_Status.by_handler' }, someCustomMetadataType),
    ]
  })

  afterAll(() => {
    jest.restoreAllMocks()
  })

  beforeEach(() => {
    featureEnabledQuery.mockReturnValue(false)
  })

  describe('When the feature is disabled in adapter config', () => {
    it('Should not run', async () => {
      featureEnabledQuery.mockReturnValue(true)
      const elements = [typeWithFormula.clone()]
      await filter.onFetch(elements)
      // eslint-disable-next-line no-underscore-dangle
      const deps = elements[0].fields.someFormulaField__c.annotations._generated_dependencies
      expect(deps).not.toBeDefined()
    })
  })

  describe('When the formula has a reference', () => {
    it('Should return a field reference as a dependency', async () => {
      const elements = [typeWithFormula.clone()]
      await filter.onFetch(elements)
      // eslint-disable-next-line no-underscore-dangle
      const deps = elements[0].fields.someFormulaField__c.annotations._generated_dependencies
      expect(deps).toBeDefined()
      expect(deps[0]).toEqual(depNameToRefExpr(typeWithFormula.elemID.typeName))
      expect(deps[1]).toEqual(depNameToRefExpr(typeWithFormula.elemID.typeName, 'someField__c'))
    })
    it('Should return a Metadata Type Record field reference as a dependency', async () => {
      const customMetadataType = customObjectTypeWithFields('SomeCustomMetadataType__mdt', { SomeTextField__c: BuiltinTypes.STRING })
      const typeUnderTest = typeWithFormula.clone()
      typeUnderTest.fields.someFormulaField__c.annotations[FORMULA] = '$CustomMetadata.SomeCustomMetadataType__mdt.SomeCustomMetadataTypeRecord.SomeTextField__c'
      const elements = [
        typeUnderTest,
        customMetadataType,
        createInstanceElement({ fullName: 'SomeCustomMetadataType.SomeCustomMetadataTypeRecord' }, customMetadataType),
      ]
      await filter.onFetch(elements)
      // eslint-disable-next-line no-underscore-dangle
      const deps = typeUnderTest.fields.someFormulaField__c.annotations._generated_dependencies
      expect(deps).toBeDefined()

      const expectedRefs = [
        {
          reference: new ReferenceExpression(new ElemID(SALESFORCE, 'SomeCustomMetadataType__mdt')),
        },
        {
          reference: new ReferenceExpression(new ElemID(SALESFORCE, 'SomeCustomMetadataType__mdt', 'field', 'SomeTextField__c')),
        },
        {
          reference: new ReferenceExpression(new ElemID(SALESFORCE, 'SomeCustomMetadataType__mdt', 'instance', 'SomeCustomMetadataType_SomeCustomMetadataTypeRecord@v')),
        },
      ]
      expect(deps).toEqual(expectedRefs)
    })
    it('should not return a reference if it refers to something that doesn\'t exist', async () => {
      const typeUnderTest = typeWithFormula.clone()
      typeUnderTest.fields.someFormulaField__c.annotations[FORMULA] = 'ISBLANK(someField__c) && ISBLANK(GarbageType.DreckField)'

      await filter.onFetch([typeUnderTest])
      // eslint-disable-next-line no-underscore-dangle
      const deps = typeUnderTest.fields.someFormulaField__c.annotations._generated_dependencies
      expect(deps).toBeDefined()
      expect(deps).toHaveLength(2)
      expect(deps[0].reference.elemID.typeName).not.toEqual('GarbageType')
      expect(deps[1].reference.elemID.typeName).not.toEqual('GarbageType')
    })
  })

  describe('When referencing RecordType', () => {
    it('should extract the correct dependencies', async () => {
      const typeUnderTest = typeWithFormula.clone()
      const elements = [typeUnderTest, ...referredTypes, ...referredInstances]
      typeUnderTest.fields.someFormulaField__c.annotations[FORMULA] = `IF( RecordType.Name = 'New Sale', 'Onboarding - New',
        IF( RecordType.Name = 'Upgrade', 'Onboarding - Upgrade',
          IF( RecordType.Name = 'Add-On', 'Onboarding - Add-On', "")))`
      await filter.onFetch(elements)
      // eslint-disable-next-line no-underscore-dangle
      const deps = typeUnderTest.fields.someFormulaField__c.annotations._generated_dependencies
      expect(deps).toBeDefined()
      expect(deps[0]).toEqual(depNameToRefExpr(typeWithFormula.elemID.typeName))
      expect(deps[1]).toEqual(depNameToRefExpr(typeWithFormula.elemID.typeName, 'RecordTypeId'))
      expect(deps[2]).toEqual(depNameToRefExpr('RecordType'))
      expect(deps[3]).toEqual(depNameToRefExpr('RecordType', 'Name'))
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
      'salesforce.Contact.field.CreatedById', 'salesforce.CustomLabel.instance.Details',
      'salesforce.Customer_Support_Setting__c', 'salesforce.Customer_Support_Setting__c.field.Email_Address__c',
      'salesforce.Opportunity', 'salesforce.Opportunity.field.AccountId', 'salesforce.Opportunity__r',
      'salesforce.Opportunity__r.field.Related_Asset__c', 'salesforce.Organization',
      'salesforce.Organization.field.UiSkin', 'salesforce.Profile', 'salesforce.Profile.field.Id',
      'salesforce.Related_Asset__r', 'salesforce.Related_Asset__r.field.Name',
      'salesforce.SRM_API_Metadata_Client_Setting__mdt',
      'salesforce.SRM_API_Metadata_Client_Setting__mdt.field.CreatedDate', 'salesforce.Trigger_Context_Status__mdt',
      'salesforce.Trigger_Context_Status__mdt.field.DeveloperName',
      'salesforce.Trigger_Context_Status__mdt.field.Enable_After_Insert__c',
      'salesforce.Trigger_Context_Status__mdt.instance.Trigger_Context_Status_by_class@uuvu',
      'salesforce.Trigger_Context_Status__mdt.instance.Trigger_Context_Status_by_handler@uuvu', 'salesforce.User',
      'salesforce.User.field.CompanyName', 'salesforce.User.field.ContactId', 'salesforce.User.field.ManagerId',
      'salesforce.User.field.ProfileId']
    const processBuilderFormulaExpectedRefs = ['salesforce.Account', 'salesforce.Account.field.AccountNumber',
      'salesforce.Account.field.OwnerId', 'salesforce.Account.field.original_lead__c', 'salesforce.Contact',
      'salesforce.Contact.field.AccountId', 'salesforce.Trigger_Context_Status__mdt',
      'salesforce.Trigger_Context_Status__mdt.field.Enable_After_Delete__c',
      'salesforce.Trigger_Context_Status__mdt.instance.Trigger_Context_Status_by_class@uuvu', 'salesforce.User',
      'salesforce.User.field.ContactId', 'salesforce.User.field.ManagerId', 'salesforce.original_lead__r',
      'salesforce.original_lead__r.field.ConvertedAccountId']
    it('Should extract the correct references from a complex standard formula', async () => {
      const typeUnderTest = typeWithFormula.clone()
      typeUnderTest.fields.someFormulaField__c.annotations[FORMULA] = standardFormula
      const elements = [typeUnderTest, ...referredTypes, ...referredInstances]
      await filter.onFetch(elements)
      // eslint-disable-next-line no-underscore-dangle
      const deps = typeUnderTest.fields.someFormulaField__c.annotations._generated_dependencies
      expect(deps).toBeDefined()
      expect(deps.map(({ reference }: {reference: ReferenceExpression}) => reference.elemID.getFullName()))
        .toEqual(standardFormulaExpectedRefs)
    })

    it('Should extract the correct references from a Process Builder formula', async () => {
      const typeUnderTest = typeWithFormula.clone()
      typeUnderTest.fields.someFormulaField__c.annotations[FORMULA] = processBuilderFormula
      const elements = [typeUnderTest, ...referredTypes, ...referredInstances]
      await filter.onFetch(elements)
      // eslint-disable-next-line no-underscore-dangle
      const deps = typeUnderTest.fields.someFormulaField__c.annotations._generated_dependencies
      expect(deps).toBeDefined()
      expect(deps.map((refExpr: {reference: ReferenceExpression}) => refExpr.reference.elemID.getFullName()))
        .toEqual(processBuilderFormulaExpectedRefs)
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
    let referredObjectTypes: ObjectType[]

    beforeAll(() => {
      typeWithCpqFormula = createCustomObjectType('SBQQ__QuoTE__c',
        {
          fields: {
            SBQQ__DistriBUtor__c: {
              refType: BuiltinTypes.STRING,
            },
            SBQQ__random__c: {
              refType: BuiltinTypes.STRING,
            },
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
      referredObjectTypes = [
        customObjectTypeWithFields('SBQQ__random__r', { Name: BuiltinTypes.STRING }),
        customObjectTypeWithFields('Account', { Name: BuiltinTypes.STRING }),
      ]
    })

    it('Should extract the correct references from a CPQ formula', async () => {
      const elements = [typeWithCpqFormula.clone(), ...referredObjectTypes]
      elements[0].fields.someFormulaField__c.annotations[FORMULA] = simpleFormula
      await filter.onFetch(elements)
      // eslint-disable-next-line no-underscore-dangle
      const deps = elements[0].fields.someFormulaField__c.annotations._generated_dependencies
      expect(deps).toBeDefined()
      expect(deps.map((refExpr: {reference: ReferenceExpression}) => refExpr.reference.elemID.getFullName()).sort())
        .toEqual(simpleFormulaExpectedDeps)
    })

    it('Should extract the correct references from a CPQ formula with unknown relationship', async () => {
      const elements = [typeWithCpqFormula.clone(), ...referredObjectTypes]
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
