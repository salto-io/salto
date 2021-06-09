/*
*                      Copyright 2021 Salto Labs Ltd.
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
import _ from 'lodash'
import { ElemID, InstanceElement, ObjectType, ReferenceExpression, Element, BuiltinTypes, ListType, CORE_ANNOTATIONS, isReferenceExpression } from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils } from '@salto-io/adapter-components'
import { createRefToElmWithValue, DetailedDependency } from '@salto-io/adapter-utils'
import filterCreator from '../../src/filters/cross_service/recipe_references'
import WorkatoClient from '../../src/client/client'
import { paginate } from '../../src/client/pagination'
import { DEFAULT_TYPES, DEFAULT_ID_FIELDS } from '../../src/config'
import { WORKATO } from '../../src/constants'

/* eslint-disable camelcase */

describe('Recipe references filter', () => {
  let client: WorkatoClient
  type FilterType = filterUtils.FilterWith<'onPostFetch'>
  let filter: FilterType

  const dereferenceDep = (dep: DetailedDependency): unknown => ({
    reference: dep.reference.elemID.getFullName(),
    occurrences: dep.occurrences?.map(
      oc => ({ ...oc, location: oc.location?.elemID.getFullName() })
    ),
  })


  beforeAll(() => {
    client = new WorkatoClient({
      credentials: { username: 'a', token: 'b' },
    })
    filter = filterCreator({
      client,
      paginator: clientUtils.createPaginator({
        client,
        paginationFunc: paginate,
      }),
      config: {
        fetch: {
          includeTypes: ['connection', 'recipe'],
          serviceConnectionNames: {
            salesforce: ['salesforce sandbox 1'],
            netsuite: ['netsuite sbx 123'],
            ignore: ['abc'],
          },
        },
        apiDefinitions: {
          typeDefaults: {
            transformation: {
              idFields: DEFAULT_ID_FIELDS,
            },
          },
          types: DEFAULT_TYPES,
        },
      },
    }) as FilterType
  })

  const generateCurrentAdapterElements = (
  ): Element[] => {
    const connectionType = new ObjectType({
      elemID: new ElemID(WORKATO, 'connection'),
      fields: {
        id: { refType: createRefToElmWithValue(BuiltinTypes.NUMBER) },
        application: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
        name: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
      },
    })

    const sfSandbox1 = new InstanceElement(
      'salesforce_sandbox_1',
      connectionType,
      {
        id: 1234,
        application: 'salesforce',
        name: 'salesforce sandbox 1',
      }
    )
    const anotherSfSandbox = new InstanceElement(
      'another_salesforce_sandbox',
      connectionType,
      {
        id: 1235,
        application: 'salesforce',
        name: 'another salesforce sandbox',
      }
    )
    const netsuiteSandbox123 = new InstanceElement(
      'netsuite_sbx_123',
      connectionType,
      {
        id: 1236,
        application: 'netsuite',
        name: 'netsuite sbx 123',
      }
    )

    const secondarySalesforce = new InstanceElement(
      'secondary_sf',
      connectionType,
      {
        id: 1235,
        application: 'salesforce_secondary',
        name: 'secondary salesforce',
      }
    )
    const secondaryNetsuite = new InstanceElement(
      'secondary_ns',
      connectionType,
      {
        id: 1236,
        application: 'netsuite_secondary',
        name: 'secondary netsuite',
      }
    )

    const labelValueType = new ObjectType({
      elemID: new ElemID(WORKATO, 'labelValue'),
      fields: {
        label: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
        value: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
      },
    })

    const dynamicPickListSelectionType = new ObjectType({
      elemID: new ElemID(WORKATO, 'recipe__code__dynamicPickListSelection'),
      fields: {
        sobject_name: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
        netsuite_object: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
        topic_id: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
        table_list: { refType: createRefToElmWithValue(new ListType(labelValueType)) },
        field_list: { refType: createRefToElmWithValue(new ListType(labelValueType)) },
      },
    })

    const inputType = new ObjectType({
      elemID: new ElemID(WORKATO, 'recipe__code__input'),
      fields: {
        sobject_name: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
        netsuite_object: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
        topic_id: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
        table_list: { refType: createRefToElmWithValue(new ListType(labelValueType)) },
        field_list: { refType: createRefToElmWithValue(new ListType(labelValueType)) },
      },
    })

    // imitate 3-level recursive type generation until we fix it

    const nestedBlockTypeInner = new ObjectType({
      elemID: new ElemID(WORKATO, 'recipe__code__block__block__block'),
      fields: {
        provider: {
          refType: createRefToElmWithValue(BuiltinTypes.STRING),
        },
        name: {
          refType: createRefToElmWithValue(BuiltinTypes.STRING),
        },
        dynamicPickListSelection: {
          refType: createRefToElmWithValue(dynamicPickListSelectionType),
        },
        input: {
          refType: createRefToElmWithValue(inputType),
        },
        as: {
          refType: createRefToElmWithValue(BuiltinTypes.STRING),
        },
      },
    })

    const nestedBlockType = new ObjectType({
      elemID: new ElemID(WORKATO, 'recipe__code__block__block'),
      fields: {
        provider: {
          refType: createRefToElmWithValue(BuiltinTypes.STRING),
        },
        name: {
          refType: createRefToElmWithValue(BuiltinTypes.STRING),
        },
        dynamicPickListSelection: {
          refType: createRefToElmWithValue(dynamicPickListSelectionType),
        },
        input: {
          refType: createRefToElmWithValue(inputType),
        },
        block: {
          refType: createRefToElmWithValue(new ListType(nestedBlockTypeInner)),
        },
        as: {
          refType: createRefToElmWithValue(BuiltinTypes.STRING),
        },
      },
    })

    const blockType = new ObjectType({
      elemID: new ElemID(WORKATO, 'recipe__code__block'),
      fields: {
        provider: {
          refType: createRefToElmWithValue(BuiltinTypes.STRING),
        },
        name: {
          refType: createRefToElmWithValue(BuiltinTypes.STRING),
        },
        dynamicPickListSelection: {
          refType: createRefToElmWithValue(dynamicPickListSelectionType),
        },
        input: {
          refType: createRefToElmWithValue(inputType),
        },
        block: {
          refType: createRefToElmWithValue(new ListType(nestedBlockType)),
        },
        as: {
          refType: createRefToElmWithValue(BuiltinTypes.STRING),
        },
      },
    })

    const codeType = new ObjectType({
      elemID: new ElemID(WORKATO, 'recipe__code'),
      fields: {
        provider: {
          refType: createRefToElmWithValue(BuiltinTypes.STRING),
        },
        name: {
          refType: createRefToElmWithValue(BuiltinTypes.STRING),
        },
        dynamicPickListSelection: {
          refType: createRefToElmWithValue(dynamicPickListSelectionType),
        },
        input: {
          refType: createRefToElmWithValue(inputType),
        },
        block: {
          refType: createRefToElmWithValue(new ListType(blockType)),
        },
        as: {
          refType: createRefToElmWithValue(BuiltinTypes.STRING),
        },
      },
    })

    const recipeConfigType = new ObjectType({
      elemID: new ElemID(WORKATO, 'recipe__config'),
      fields: {
        name: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
        provider: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
        account_id: { refType: createRefToElmWithValue(BuiltinTypes.NUMBER) },
        keyword: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
      },
    })

    const recipeType = new ObjectType({
      elemID: new ElemID(WORKATO, 'recipe'),
      fields: {
        code: {
          refType: createRefToElmWithValue(codeType),
        },
        config: {
          refType: createRefToElmWithValue(recipeConfigType),
        },
        applications: {
          refType: createRefToElmWithValue(new ListType(BuiltinTypes.STRING)),
        },
        trigger_application: {
          refType: createRefToElmWithValue(BuiltinTypes.STRING),
        },
        action_applications: {
          refType: createRefToElmWithValue(new ListType(BuiltinTypes.STRING)),
        },
      },
    })

    const sharedRecipeCode = {
      as: '1234aaaa',
      provider: 'salesforce',
      name: 'updated_custom_object',
      keyword: 'trigger',
      dynamicPickListSelection: {
        sobject_name: 'Opportunity',
        field_list: [
          {
            label: 'Opportunity ID',
            value: 'Id',
          },
          {
            label: 'Account ID',
            value: 'AccountId',
          },
          {
            label: 'Name',
            value: 'Name',
          },
          {
            label: 'Custom field',
            value: 'Custom__c',
          },
          {
            label: 'Owner.Field 123 label',
            value: 'User$Owner or some other label to ignore.Field111__c',
          },
        ],
        table_list: [
          {
            label: 'Price Book',
            value: 'Pricebook2',
          },
          {
            label: 'Owner',
            value: 'User',
          },
          {
            label: 'Account',
            value: 'Account',
          },
        ],
      },
      input: {
        sobject_name: 'Opportunity',
        // sets the value of Custom__c using netsuite custom fields
        Custom__c: "some prefix to ignore #{_('data.netsuite.211cdf34.dateCreated')} #{_('data.netsuite.12345678.custom_fields.f_custrecordaccount_id')}#{_('data.netsuite.211cdf34.custom_fields.f_123_custrecord5')} #{_('data.netsuite.44bf4bfd.Customers.first.custom_fields.f_126_custentitycustom_account_city')} ignore",
      },
      block: [
        {
          as: 'nestedid1',
          keyword: 'action',
          provider: 'netsuite',
          name: 'add_object',
          dynamicPickListSelection: {
            netsuite_object: 'custom record type label',
            custom_list: [
              { value: 'othercustomfield@custrecord2', label: 'something' },
            ],
          },
          input: {
            netsuite_object: 'custom record type label@@customrecord16',
          },
          block: [
            {
              as: 'nestedid2',
              provider: 'salesforce',
              keyword: 'action',
              name: 'updated_custom_object',
              dynamicPickListSelection: {
                sobject_name: 'My Custom',
              },
              input: {
                sobject_name: 'MyCustom__c',
                customField__c: '#{_(\'data.salesforce.1234aaaa.Opportunity.first.FormulaRef1__c\')}',
                something1: '#{_(\'data.salesforce.1234aaaa.sobject.FormulaRef2__c\')}',
                something2: '#{_(\'data.salesforce.1234aaaa.FormulaRef3__c\')}',
                something3: '#{_(\'data.salesforce.1234aaaa.sobject.User.Field222__c\')}',
                getCustomObject: '#{_(\'data.salesforce.1234aaaa.get_custom_object(UserId>id, sobject_name: User).Name__c\')}#{_(\'data.salesforce.1234aaaa.get_custom_object(CampaignId>id, sobject_name: Campaign).get_custom_object(CampaignMemberRecordTypeId>id, sobject_name: Opportunity).FormulaRef4__c\')}',
                unknown1: '#{_(\'data.salesforce.1234aaaa.sobject.User.unknown\')}',
                unknown2: '#{_(\'data.salesforce.1234aaaa.unknown.first.FormulaRef1__c\')}',
              },
            },
          ],
        },
      ],
    }

    const recipe1code = new InstanceElement(
      'recipe1_code',
      codeType,
      _.cloneDeep(sharedRecipeCode),
    )
    const recipe1 = new InstanceElement('recipe1', recipeType, {
      config: [
        {
          keyword: 'application',
          name: 'salesforce',
          provider: 'salesforce',
          account_id: new ReferenceExpression(sfSandbox1.elemID),
        },
        {
          keyword: 'application',
          name: 'rest',
          provider: 'rest',
        },
        {
          keyword: 'application',
          name: 'netsuite',
          provider: 'netsuite',
          account_id: new ReferenceExpression(netsuiteSandbox123.elemID),
        },
      ],
      code: new ReferenceExpression(recipe1code.elemID),
    })

    const recipe2WrongConnectionCode = new InstanceElement('recipe2_code', codeType, _.cloneDeep(sharedRecipeCode))
    const recipe2WrongConnection = new InstanceElement('recipe2', recipeType, {
      config: [
        {
          keyword: 'application',
          name: 'salesforce',
          provider: 'salesforce',
          account_id: new ReferenceExpression(anotherSfSandbox.elemID),
        },
        {
          keyword: 'application',
          name: 'rest',
          provider: 'rest',
        },
      ],
      code: new ReferenceExpression(recipe2WrongConnectionCode.elemID),
    })

    const recipe3OnlyNetsuiteCode = new InstanceElement('recipe3_code', codeType, _.cloneDeep(sharedRecipeCode))
    const recipe3OnlyNetsuite = new InstanceElement('recipe3', recipeType, {
      config: [
        {
          keyword: 'application',
          name: 'salesforce',
          provider: 'salesforce',
          account_id: new ReferenceExpression(anotherSfSandbox.elemID),
        },
        {
          keyword: 'application',
          name: 'rest',
          provider: 'rest',
        },
        {
          keyword: 'application',
          name: 'netsuite',
          provider: 'netsuite',
          account_id: new ReferenceExpression(netsuiteSandbox123.elemID),
        },
      ],
      code: new ReferenceExpression(recipe3OnlyNetsuiteCode.elemID),
    })
    const recipe4UnknownSalesforceSobjectCode = new InstanceElement('recipe4_code', codeType, {
      as: 'recipe4id',
      provider: 'salesforce',
      name: 'updated_custom_object',
      dynamicPickListSelection: {
        sobject_name: 'Unknown',
        field_list: [
          {
            label: 'Opportunity ID',
            value: 'Id',
          },
          {
            label: 'Account ID',
            value: 'AccountId',
          },
          {
            label: 'Name',
            value: 'Name',
          },
          {
            label: 'Custom field',
            value: 'Custom__c',
          },
        ],
        table_list: [
          {
            label: 'Price Book',
            value: 'Pricebook2',
          },
          {
            label: 'Owner',
            value: 'User',
          },
          {
            label: 'Account',
            value: 'Account',
          },
        ],
      },
      input: {
        sobject_name: 'Unknown',
      },
    })
    const recipe4UnknownSalesforceSobject = new InstanceElement('recipe4', recipeType, {
      config: [
        {
          keyword: 'application',
          name: 'salesforce',
          provider: 'salesforce',
          account_id: new ReferenceExpression(anotherSfSandbox.elemID),
        },
      ],
      code: new ReferenceExpression(recipe4UnknownSalesforceSobjectCode.elemID),
    })
    const recipe5WithSecondaryCode = new InstanceElement(
      'recipe5_code',
      codeType,
      {
        as: '1234aaaa',
        provider: 'salesforce_secondary',
        name: 'updated_custom_object',
        keyword: 'trigger',
        dynamicPickListSelection: {
          sobject_name: 'Opportunity',
        },
        input: {
          sobject_name: 'Opportunity',
          // sets the value of Custom__c using netsuite custom fields
          Custom__c: "some prefix to ignore #{_('data.netsuite_secondary.211cdf34.dateCreated')} #{_('data.netsuite_secondary.12345678.custom_fields.f_custrecordaccount_id')}#{_('data.netsuite_secondary.211cdf34.custom_fields.f_123_custrecord5')} #{_('data.netsuite_secondary.44bf4bfd.Customers.first.custom_fields.f_126_custentitycustom_account_city')} ignore",
        },
        block: [
          {
            as: 'nestedid1',
            provider: 'netsuite_secondary',
            keyword: 'action',
            name: 'add_object',
            dynamicPickListSelection: {
              netsuite_object: 'custom record type label',
              custom_list: [
                { value: 'othercustomfield@custrecord2', label: 'something' },
              ],
            },
            input: {
              netsuite_object: 'custom record type label@@customrecord16',
            },
            block: [
              {
                as: 'nestedid2',
                provider: 'salesforce',
                keyword: 'action',
                name: 'updated_custom_object',
                dynamicPickListSelection: {
                  sobject_name: 'My Custom',
                },
                input: {
                  sobject_name: 'MyCustom__c',
                  customField__c: '#{_(\'data.salesforce_secondary.1234aaaa.Opportunity.first.FormulaRef1__c\')}',
                  something1: '#{_(\'data.salesforce_secondary.1234aaaa.sobject.FormulaRef2__c\')}',
                  something2: '#{_(\'data.salesforce_secondary.1234aaaa.FormulaRef3__c\')}',
                  unknown2: '#{_(\'data.salesforce_secondary.1234aaaa.unknown.first.FormulaRef1__c\')}',
                },
              },
            ],
          },
        ],
      },
    )
    const recipe5WithSecondary = new InstanceElement('recipe5', recipeType, {
      config: [
        {
          keyword: 'application',
          name: 'salesforce',
          provider: 'salesforce',
          account_id: new ReferenceExpression(sfSandbox1.elemID),
        },
        {
          keyword: 'application',
          name: 'rest',
          provider: 'rest',
        },
        {
          keyword: 'application',
          name: 'netsuite',
          provider: 'netsuite',
          account_id: new ReferenceExpression(netsuiteSandbox123.elemID),
        },
        {
          keyword: 'application',
          name: 'salesforce_secondary',
          provider: 'salesforce_secondary',
          account_id: new ReferenceExpression(secondarySalesforce.elemID),
        },
        {
          keyword: 'application',
          name: 'netsuite_secondary',
          provider: 'netsuite_secondary',
          account_id: new ReferenceExpression(secondaryNetsuite.elemID),
        },
      ],
      code: new ReferenceExpression(recipe5WithSecondaryCode.elemID),
    })

    return [
      connectionType,
      sfSandbox1,
      anotherSfSandbox,
      netsuiteSandbox123,
      secondarySalesforce,
      secondaryNetsuite,
      labelValueType,
      dynamicPickListSelectionType,
      inputType,
      nestedBlockTypeInner,
      nestedBlockType,
      blockType,
      codeType,
      recipeConfigType,
      recipeType,
      recipe1,
      recipe1code,
      recipe2WrongConnection,
      recipe2WrongConnectionCode,
      recipe3OnlyNetsuite,
      recipe3OnlyNetsuiteCode,
      recipe4UnknownSalesforceSobject,
      recipe4UnknownSalesforceSobjectCode,
      recipe5WithSecondary,
      recipe5WithSecondaryCode,
    ]
  }

  const generateSalesforceElements = (): Element[] => {
    const opportunity = new ObjectType({
      elemID: new ElemID('salesforce', 'Opportunity'),
      fields: {
        Id: {
          refType: createRefToElmWithValue(BuiltinTypes.STRING),
          annotations: {
            apiName: 'Opportunity.Id',
          },
        },
        Custom__c: {
          refType: createRefToElmWithValue(BuiltinTypes.STRING),
          annotations: {
            apiName: 'Opportunity.Custom__c',
          },
        },
        Name: {
          refType: createRefToElmWithValue(BuiltinTypes.STRING),
          annotations: {
            apiName: 'Opportunity.Name',
          },
        },
        FormulaRef1__c: {
          refType: createRefToElmWithValue(BuiltinTypes.STRING),
          annotations: {
            apiName: 'Opportunity.FormulaRef1__c',
          },
        },
        FormulaRef2__c: {
          refType: createRefToElmWithValue(BuiltinTypes.STRING),
          annotations: {
            apiName: 'Opportunity.FormulaRef2__c',
          },
        },
        FormulaRef3__c: {
          refType: createRefToElmWithValue(BuiltinTypes.STRING),
          annotations: {
            apiName: 'Opportunity.FormulaRef3__c',
          },
        },
        FormulaRef4__c: {
          refType: createRefToElmWithValue(BuiltinTypes.STRING),
          annotations: {
            apiName: 'Opportunity.FormulaRef4__c',
          },
        },
      },
      annotations: {
        metadataType: 'CustomObject',
        apiName: 'Opportunity',
        label: 'Opportunity',
      },
    })
    const user = new ObjectType({
      elemID: new ElemID('salesforce', 'User'),
      fields: {
        Field111__c: {
          refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
          annotations: {
            apiName: 'User.Field111__c',
          },
        },
        Field222__c: {
          refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
          annotations: {
            apiName: 'User.Field222__c',
          },
        },
        Name__c: {
          refType: createRefToElmWithValue(BuiltinTypes.STRING),
          annotations: {
            apiName: 'User.Name__c',
          },
        },
      },
      annotations: {
        metadataType: 'CustomObject',
        apiName: 'User',
      },
    })
    const myCustom = new ObjectType({
      elemID: new ElemID('salesforce', 'MyCustom__c'),
      fields: {
        customField__c: { refType: createRefToElmWithValue(BuiltinTypes.NUMBER) },
      },
      annotations: {
        metadataType: 'CustomObject',
        apiName: 'MyCustom__c',
        label: 'My Custom',
      },
    })

    return [opportunity, user, myCustom]
  }
  const generateNetsuiteElements = (): Element[] => {
    const customRecordType = new ObjectType({
      elemID: new ElemID('netsuite', 'customrecordtype'),
      fields: {},
    })
    const myCustomRecord = new InstanceElement(
      'customrecord16',
      customRecordType,
      {
        scriptid: 'customrecord16',
        recordname: 'my custom record',
        customrecordcustomfields: {
          customrecordcustomfield: [
            { scriptid: 'custrecord5' },
            { scriptid: 'somethingelse' },
            { scriptid: 'custrecordaccount_id' },
          ],
        },
      }
    )

    const otherCustomFieldType = new ObjectType({
      elemID: new ElemID('netsuite', 'othercustomfield'),
      fields: {},
    })
    const otherCustomFieldInst = new InstanceElement(
      'custrecord2',
      otherCustomFieldType,
      {
        scriptid: 'custrecord2',
        recordname: 'something',
      }
    )

    const entitycustomfieldType = new ObjectType({
      elemID: new ElemID('netsuite', 'entitycustomfield'),
      fields: {},
    })
    const entitycustomfieldInst = new InstanceElement(
      'custentitycustom_account_city',
      entitycustomfieldType,
      {
        scriptid: 'custentitycustom_account_city',
        appliestocontact: false,
        appliestocustomer: true,
        appliestoemployee: false,
      }
    )

    return [
      customRecordType, myCustomRecord,
      otherCustomFieldType, otherCustomFieldInst,
      entitycustomfieldType, entitycustomfieldInst,
    ]
  }

  describe('on post-fetch primary', () => {
    let currentAdapterElements: Element[]
    let salesforceElements: Element[]
    let netsuiteElements: Element[]

    beforeAll(async () => {
      filter = filterCreator({
        client,
        paginator: clientUtils.createPaginator({
          client,
          paginationFunc: paginate,
        }),
        config: {
          fetch: {
            includeTypes: ['connection', 'recipe'],
            serviceConnectionNames: {
              salesforce: ['salesforce sandbox 1'],
              netsuite: ['netsuite sbx 123'],
            },
          },
          apiDefinitions: {
            typeDefaults: {
              transformation: {
                idFields: DEFAULT_ID_FIELDS,
              },
            },
            types: DEFAULT_TYPES,
          },
        },
      }) as FilterType

      currentAdapterElements = generateCurrentAdapterElements()
      salesforceElements = generateSalesforceElements()
      netsuiteElements = generateNetsuiteElements()
      await filter.onPostFetch({
        currentAdapterElements,
        elementsByAdapter: {
          salesforce: salesforceElements,
          netsuite: netsuiteElements,
        },
        progressReporter: { reportProgress: () => null },
      })
    })

    describe('recipe1', () => {
      it('should show all resolved references in the _generated_dependencies annotation, in alphabetical order', () => {
        const recipeCode = currentAdapterElements.find(e => e.elemID.getFullName() === 'workato.recipe__code.instance.recipe1_code')
        expect(recipeCode).toBeDefined()
        expect(recipeCode?.annotations?.[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toBeDefined()
        expect(recipeCode?.annotations?.[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toHaveLength(19)
        expect(recipeCode?.annotations?.[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES].map(
          dereferenceDep
        )).toEqual([
          { reference: 'netsuite.customrecordtype.instance.customrecord16', occurrences: [{ location: 'workato.recipe__code.instance.recipe1_code.block.0', direction: 'output' }] },
          { reference: 'netsuite.customrecordtype.instance.customrecord16.customrecordcustomfields.customrecordcustomfield.0', occurrences: [{ location: 'workato.recipe__code.instance.recipe1_code.input.Custom__c', direction: 'input' }] },
          { reference: 'netsuite.customrecordtype.instance.customrecord16.customrecordcustomfields.customrecordcustomfield.2', occurrences: [{ location: 'workato.recipe__code.instance.recipe1_code.input.Custom__c', direction: 'input' }] },
          { reference: 'netsuite.entitycustomfield.instance.custentitycustom_account_city', occurrences: [{ location: 'workato.recipe__code.instance.recipe1_code.input.Custom__c', direction: 'input' }] },
          { reference: 'netsuite.othercustomfield.instance.custrecord2', occurrences: [{ location: 'workato.recipe__code.instance.recipe1_code.block.0', direction: 'output' }] },
          { reference: 'salesforce.MyCustom__c', occurrences: [{ location: 'workato.recipe__code.instance.recipe1_code.block.0.block.0', direction: 'output' }] },
          { reference: 'salesforce.MyCustom__c.field.customField__c', occurrences: [{ location: 'workato.recipe__code.instance.recipe1_code.block.0.block.0', direction: 'output' }] },
          { reference: 'salesforce.Opportunity', occurrences: [{ location: 'workato.recipe__code.instance.recipe1_code', direction: 'input' }] },
          { reference: 'salesforce.Opportunity.field.Custom__c', occurrences: [{ location: 'workato.recipe__code.instance.recipe1_code', direction: 'input' }] },
          { reference: 'salesforce.Opportunity.field.FormulaRef1__c', occurrences: [{ location: 'workato.recipe__code.instance.recipe1_code.block.0.block.0.input.customField__c', direction: 'input' }] },
          { reference: 'salesforce.Opportunity.field.FormulaRef2__c', occurrences: [{ location: 'workato.recipe__code.instance.recipe1_code.block.0.block.0.input.something1', direction: 'input' }] },
          { reference: 'salesforce.Opportunity.field.FormulaRef3__c', occurrences: [{ location: 'workato.recipe__code.instance.recipe1_code.block.0.block.0.input.something2', direction: 'input' }] },
          { reference: 'salesforce.Opportunity.field.FormulaRef4__c', occurrences: [{ location: 'workato.recipe__code.instance.recipe1_code.block.0.block.0.input.getCustomObject', direction: 'input' }] },
          { reference: 'salesforce.Opportunity.field.Id', occurrences: [{ location: 'workato.recipe__code.instance.recipe1_code', direction: 'input' }] },
          { reference: 'salesforce.Opportunity.field.Name', occurrences: [{ location: 'workato.recipe__code.instance.recipe1_code', direction: 'input' }] },
          {
            reference: 'salesforce.User',
            occurrences: [
              { location: 'workato.recipe__code.instance.recipe1_code', direction: 'input' },
              { location: 'workato.recipe__code.instance.recipe1_code.block.0.block.0.input.unknown1', direction: 'input' },
            ],
          },
          { reference: 'salesforce.User.field.Field111__c', occurrences: [{ location: 'workato.recipe__code.instance.recipe1_code', direction: 'input' }] },
          { reference: 'salesforce.User.field.Field222__c', occurrences: [{ location: 'workato.recipe__code.instance.recipe1_code.block.0.block.0.input.something3', direction: 'input' }] },
          { reference: 'salesforce.User.field.Name__c', occurrences: [{ location: 'workato.recipe__code.instance.recipe1_code.block.0.block.0.input.getCustomObject', direction: 'input' }] },
        ])
      })

      it('should resolve references in-place where possible', () => {
        const recipeCode = currentAdapterElements.find(
          e => e.elemID.getFullName() === 'workato.recipe__code.instance.recipe1_code'
        ) as InstanceElement
        expect(recipeCode).toBeInstanceOf(InstanceElement)
        expect(recipeCode.value.input.sobject_name).toBeInstanceOf(
          ReferenceExpression
        )
        expect(recipeCode.value.input.sobject_name.elemID.getFullName()).toEqual('salesforce.Opportunity')
        expect(recipeCode.value.dynamicPickListSelection.sobject_name).toBeInstanceOf(
          ReferenceExpression
        )
        expect(recipeCode.value.dynamicPickListSelection.sobject_name.elemID.getFullName()).toEqual('salesforce.Opportunity')
        expect(recipeCode.value.dynamicPickListSelection.field_list).toHaveLength(5)
        // some, but not all, references are resolved
        expect(
          recipeCode.value.dynamicPickListSelection.field_list.every(isReferenceExpression)
        ).toBeFalsy()
        expect(
          recipeCode.value.dynamicPickListSelection.field_list.some(isReferenceExpression)
        ).toBeTruthy()
        expect(recipeCode.value.dynamicPickListSelection.field_list[0].elemID.getFullName()).toEqual('salesforce.Opportunity.field.Id')
        expect(recipeCode.value.dynamicPickListSelection.field_list[1]).toEqual({ label: 'Account ID', value: 'AccountId' })
        expect(recipeCode.value.dynamicPickListSelection.field_list[2].elemID.getFullName()).toEqual('salesforce.Opportunity.field.Name')
        expect(recipeCode.value.dynamicPickListSelection.field_list[3].elemID.getFullName()).toEqual('salesforce.Opportunity.field.Custom__c')
        expect(recipeCode.value.dynamicPickListSelection.field_list[4].elemID.getFullName()).toEqual('salesforce.User.field.Field111__c')
        expect(recipeCode.value.dynamicPickListSelection.table_list).toHaveLength(3)
        // some, but not all, references are resolved
        expect(
          recipeCode.value.dynamicPickListSelection.table_list.every(isReferenceExpression)
        ).toBeFalsy()
        expect(
          recipeCode.value.dynamicPickListSelection.table_list.some(isReferenceExpression)
        ).toBeTruthy()
        expect(recipeCode.value.dynamicPickListSelection.table_list[0]).toEqual({ label: 'Price Book', value: 'Pricebook2' })
        expect(recipeCode.value.dynamicPickListSelection.table_list[1].elemID.getFullName()).toEqual('salesforce.User')
        expect(recipeCode.value.dynamicPickListSelection.table_list[2]).toEqual({ label: 'Account', value: 'Account' })
      })
      it('should resolve references in-place in nested blocks', () => {
        const recipeCode = currentAdapterElements.find(
          e => e.elemID.getFullName() === 'workato.recipe__code.instance.recipe1_code'
        ) as InstanceElement
        expect(recipeCode).toBeInstanceOf(InstanceElement)
        const block1 = recipeCode.value.block[0]
        expect(block1.input.netsuite_object).toBeInstanceOf(
          ReferenceExpression
        )
        expect(block1.input.netsuite_object.elemID.getFullName()).toEqual('netsuite.customrecordtype.instance.customrecord16')
        const block2 = block1.block[0]
        expect(block2.input.sobject_name).toBeInstanceOf(
          ReferenceExpression
        )
        expect(block2.input.sobject_name.elemID.getFullName()).toEqual('salesforce.MyCustom__c')
      })
    })

    describe('recipe2WrongConnection', () => {
      it('should not have any _generated_dependencies', () => {
        const recipeCode = currentAdapterElements.find(e => e.elemID.getFullName() === 'workato.recipe__code.instance.recipe2_code')
        expect(recipeCode).toBeDefined()
        expect(recipeCode?.annotations?.[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toBeUndefined()
      })

      it('should be identical to the original generated element', () => {
        const recipeCode = currentAdapterElements.find(
          e => e.elemID.getFullName() === 'workato.recipe__code.instance.recipe2_code'
        ) as InstanceElement
        const origRecipeCode = generateCurrentAdapterElements().find(
          e => e.elemID.getFullName() === 'workato.recipe__code.instance.recipe2_code'
        ) as InstanceElement
        expect(origRecipeCode.isEqual(recipeCode)).toBeTruthy()
      })
    })

    describe('recipe3OnlyNetsuite', () => {
      it('should show all netsuite resolved references in the _generated_dependencies annotation', () => {
        const recipeCode = currentAdapterElements.find(e => e.elemID.getFullName() === 'workato.recipe__code.instance.recipe3_code')
        expect(recipeCode).toBeDefined()
        expect(recipeCode?.annotations?.[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toBeDefined()
        expect(recipeCode?.annotations?.[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toHaveLength(5)
        expect(recipeCode?.annotations?.[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES].map(
          dereferenceDep
        )).toEqual([
          { reference: 'netsuite.customrecordtype.instance.customrecord16', occurrences: [{ location: 'workato.recipe__code.instance.recipe3_code.block.0', direction: 'output' }] },
          { reference: 'netsuite.customrecordtype.instance.customrecord16.customrecordcustomfields.customrecordcustomfield.0', occurrences: [{ location: 'workato.recipe__code.instance.recipe3_code.input.Custom__c', direction: 'input' }] },
          { reference: 'netsuite.customrecordtype.instance.customrecord16.customrecordcustomfields.customrecordcustomfield.2', occurrences: [{ location: 'workato.recipe__code.instance.recipe3_code.input.Custom__c', direction: 'input' }] },
          { reference: 'netsuite.entitycustomfield.instance.custentitycustom_account_city', occurrences: [{ location: 'workato.recipe__code.instance.recipe3_code.input.Custom__c', direction: 'input' }] },
          { reference: 'netsuite.othercustomfield.instance.custrecord2', occurrences: [{ location: 'workato.recipe__code.instance.recipe3_code.block.0', direction: 'output' }] },
        ])
      })

      it('should not resolve any salesforce references in-place', () => {
        const recipeCode = currentAdapterElements.find(
          e => e.elemID.getFullName() === 'workato.recipe__code.instance.recipe3_code'
        ) as InstanceElement
        expect(recipeCode).toBeInstanceOf(InstanceElement)
        expect(recipeCode.value.input.sobject_name).toEqual('Opportunity')
        expect(recipeCode.value.dynamicPickListSelection.sobject_name).toEqual('Opportunity')
        expect(recipeCode.value.dynamicPickListSelection.field_list).toHaveLength(5)
        expect(
          recipeCode.value.dynamicPickListSelection.field_list.some(isReferenceExpression)
        ).toBeFalsy()
        expect(
          recipeCode.value.dynamicPickListSelection.table_list.some(isReferenceExpression)
        ).toBeFalsy()
        const block2 = recipeCode.value.block[0].block[0]
        expect(block2.input.sobject_name).toEqual('MyCustom__c')
      })
      it('should resolve references in-place in nested nestuite block', () => {
        const recipeCode = currentAdapterElements.find(
          e => e.elemID.getFullName() === 'workato.recipe__code.instance.recipe3_code'
        ) as InstanceElement
        expect(recipeCode).toBeInstanceOf(InstanceElement)
        const block1 = recipeCode.value.block[0]
        expect(block1.input.netsuite_object).toBeInstanceOf(
          ReferenceExpression
        )
        expect(block1.input.netsuite_object.elemID.getFullName()).toEqual('netsuite.customrecordtype.instance.customrecord16')
      })
    })

    describe('recipe4UnknownSalesforceSobject', () => {
      it('should not have any _generated_dependencies', () => {
        const recipeCode = currentAdapterElements.find(e => e.elemID.getFullName() === 'workato.recipe__code.instance.recipe4_code')
        expect(recipeCode).toBeDefined()
        expect(recipeCode?.annotations?.[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toBeUndefined()
      })

      it('should not resolve any references in-place', () => {
        const recipeCode = currentAdapterElements.find(
          e => e.elemID.getFullName() === 'workato.recipe__code.instance.recipe4_code'
        ) as InstanceElement
        expect(recipeCode).toBeInstanceOf(InstanceElement)
        expect(recipeCode.value.input.sobject_name).toEqual('Unknown')
        expect(recipeCode.value.dynamicPickListSelection.sobject_name).toEqual('Unknown')
        expect(recipeCode.value.dynamicPickListSelection.field_list).toHaveLength(4)
        expect(
          recipeCode.value.dynamicPickListSelection.field_list.some(isReferenceExpression)
        ).toBeFalsy()
        expect(
          recipeCode.value.dynamicPickListSelection.table_list.some(isReferenceExpression)
        ).toBeFalsy()
      })
    })
    describe('recipe5WithSecondaryCode', () => {
      it('should only have _generated_dependencies for blocks that are not using the secondary connections', () => {
        const recipeCode = currentAdapterElements.find(e => e.elemID.getFullName() === 'workato.recipe__code.instance.recipe5_code')
        expect(recipeCode).toBeDefined()
        expect(recipeCode?.annotations?.[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toBeDefined()
        expect(recipeCode?.annotations?.[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toHaveLength(2)
        expect(recipeCode?.annotations?.[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES].map(
          dereferenceDep
        )).toEqual([
          { reference: 'salesforce.MyCustom__c', occurrences: [{ location: 'workato.recipe__code.instance.recipe5_code.block.0.block.0', direction: 'output' }] },
          { reference: 'salesforce.MyCustom__c.field.customField__c', occurrences: [{ location: 'workato.recipe__code.instance.recipe5_code.block.0.block.0', direction: 'output' }] },
        ])
      })
    })

    it('should return false if no elements were modified', async () => {
      const elements = generateCurrentAdapterElements()
      expect(await filter.onPostFetch({
        currentAdapterElements: elements,
        elementsByAdapter: {
          salesforce: [],
          netsuite: [],
        },
        progressReporter: { reportProgress: () => null },
      })).toBeFalsy()
    })

    it('should do nothing if serviceConnectionNames is missing', async () => {
      const elements = generateCurrentAdapterElements()

      const otherFilter = filterCreator({
        client,
        paginator: clientUtils.createPaginator({
          client,
          paginationFunc: paginate,
        }),
        config: {
          fetch: {
            includeTypes: ['connection', 'recipe'],
          },
          apiDefinitions: {
            typeDefaults: {
              transformation: {
                idFields: DEFAULT_ID_FIELDS,
              },
            },
            types: DEFAULT_TYPES,
          },
        },
      }) as FilterType

      expect(await otherFilter.onPostFetch({
        currentAdapterElements: elements,
        elementsByAdapter: {
          salesforce: [],
          netsuite: [],
        },
        progressReporter: { reportProgress: () => null },
      })).toBeFalsy()
      expect(
        elements.filter(e => e.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES] !== undefined)
      ).toHaveLength(0)
    })

    it('should handle unresolved connection names gracefully', async () => {
      const elements = generateCurrentAdapterElements()

      const otherFilter = filterCreator({
        client,
        paginator: clientUtils.createPaginator({
          client,
          paginationFunc: paginate,
        }),
        config: {
          fetch: {
            includeTypes: ['connection', 'recipe'],
            serviceConnectionNames: {
              salesforce: ['salesforce sandbox 1 unresolved'],
              netsuite: ['netsuite sbx 123'],

            },
          },
          apiDefinitions: {
            typeDefaults: {
              transformation: {
                idFields: DEFAULT_ID_FIELDS,
              },
            },
            types: DEFAULT_TYPES,
          },
        },
      }) as FilterType

      // should still resolve the netsuite references
      await otherFilter.onPostFetch({
        currentAdapterElements: elements,
        elementsByAdapter: {
          salesforce: generateSalesforceElements(),
          netsuite: generateNetsuiteElements(),
        },
        progressReporter: { reportProgress: () => null },
      })
      expect(
        elements.filter(e => e.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES] !== undefined)
      ).toHaveLength(2)
      expect(
        elements
          .flatMap(e => e.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES] ?? [])
          .map(dereferenceDep)
      ).toEqual([
        { reference: 'netsuite.customrecordtype.instance.customrecord16', occurrences: [{ location: 'workato.recipe__code.instance.recipe1_code.block.0', direction: 'output' }] },
        { reference: 'netsuite.customrecordtype.instance.customrecord16.customrecordcustomfields.customrecordcustomfield.0', occurrences: [{ location: 'workato.recipe__code.instance.recipe1_code.input.Custom__c', direction: 'input' }] },
        { reference: 'netsuite.customrecordtype.instance.customrecord16.customrecordcustomfields.customrecordcustomfield.2', occurrences: [{ location: 'workato.recipe__code.instance.recipe1_code.input.Custom__c', direction: 'input' }] },
        { reference: 'netsuite.entitycustomfield.instance.custentitycustom_account_city', occurrences: [{ location: 'workato.recipe__code.instance.recipe1_code.input.Custom__c', direction: 'input' }] },
        { reference: 'netsuite.othercustomfield.instance.custrecord2', occurrences: [{ location: 'workato.recipe__code.instance.recipe1_code.block.0', direction: 'output' }] },
        { reference: 'netsuite.customrecordtype.instance.customrecord16', occurrences: [{ location: 'workato.recipe__code.instance.recipe3_code.block.0', direction: 'output' }] },
        { reference: 'netsuite.customrecordtype.instance.customrecord16.customrecordcustomfields.customrecordcustomfield.0', occurrences: [{ location: 'workato.recipe__code.instance.recipe3_code.input.Custom__c', direction: 'input' }] },
        { reference: 'netsuite.customrecordtype.instance.customrecord16.customrecordcustomfields.customrecordcustomfield.2', occurrences: [{ location: 'workato.recipe__code.instance.recipe3_code.input.Custom__c', direction: 'input' }] },
        { reference: 'netsuite.entitycustomfield.instance.custentitycustom_account_city', occurrences: [{ location: 'workato.recipe__code.instance.recipe3_code.input.Custom__c', direction: 'input' }] },
        { reference: 'netsuite.othercustomfield.instance.custrecord2', occurrences: [{ location: 'workato.recipe__code.instance.recipe3_code.block.0', direction: 'output' }] },
      ])
    })
  })

  describe('on post-fetch primary+secondary', () => {
    let currentAdapterElements: Element[]
    let salesforceElements: Element[]
    let netsuiteElements: Element[]

    beforeAll(async () => {
      filter = filterCreator({
        client,
        paginator: clientUtils.createPaginator({
          client,
          paginationFunc: paginate,
        }),
        config: {
          fetch: {
            includeTypes: ['connection', 'recipe'],
            serviceConnectionNames: {
              salesforce: ['secondary salesforce', 'salesforce sandbox 1'],
              netsuite: ['secondary netsuite'],
            },
          },
          apiDefinitions: {
            typeDefaults: {
              transformation: {
                idFields: DEFAULT_ID_FIELDS,
              },
            },
            types: DEFAULT_TYPES,
          },
        },
      }) as FilterType

      currentAdapterElements = generateCurrentAdapterElements()
      salesforceElements = generateSalesforceElements()
      netsuiteElements = generateNetsuiteElements()
      await filter.onPostFetch({
        currentAdapterElements,
        elementsByAdapter: {
          salesforce: salesforceElements,
          netsuite: netsuiteElements,
        },
        progressReporter: { reportProgress: () => null },
      })
    })

    describe('recipe5WithSecondaryCode', () => {
      it('should show all resolved references in the _generated_dependencies annotation, in alphabetical order', () => {
        const recipeCode = currentAdapterElements.find(e => e.elemID.getFullName() === 'workato.recipe__code.instance.recipe5_code')
        expect(recipeCode).toBeDefined()
        expect(recipeCode?.annotations?.[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toBeDefined()
        expect(recipeCode?.annotations?.[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toHaveLength(12)
        expect(recipeCode?.annotations?.[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES].map(
          dereferenceDep
        )).toEqual([
          { reference: 'netsuite.customrecordtype.instance.customrecord16', occurrences: [{ location: 'workato.recipe__code.instance.recipe5_code.block.0', direction: 'output' }] },
          { reference: 'netsuite.customrecordtype.instance.customrecord16.customrecordcustomfields.customrecordcustomfield.0', occurrences: [{ location: 'workato.recipe__code.instance.recipe5_code.input.Custom__c', direction: 'input' }] },
          { reference: 'netsuite.customrecordtype.instance.customrecord16.customrecordcustomfields.customrecordcustomfield.2', occurrences: [{ location: 'workato.recipe__code.instance.recipe5_code.input.Custom__c', direction: 'input' }] },
          { reference: 'netsuite.entitycustomfield.instance.custentitycustom_account_city', occurrences: [{ location: 'workato.recipe__code.instance.recipe5_code.input.Custom__c', direction: 'input' }] },
          { reference: 'netsuite.othercustomfield.instance.custrecord2', occurrences: [{ location: 'workato.recipe__code.instance.recipe5_code.block.0', direction: 'output' }] },
          { reference: 'salesforce.MyCustom__c', occurrences: [{ location: 'workato.recipe__code.instance.recipe5_code.block.0.block.0', direction: 'output' }] },
          { reference: 'salesforce.MyCustom__c.field.customField__c', occurrences: [{ location: 'workato.recipe__code.instance.recipe5_code.block.0.block.0', direction: 'output' }] },
          { reference: 'salesforce.Opportunity', occurrences: [{ location: 'workato.recipe__code.instance.recipe5_code', direction: 'input' }] },
          { reference: 'salesforce.Opportunity.field.Custom__c', occurrences: [{ location: 'workato.recipe__code.instance.recipe5_code', direction: 'input' }] },
          { reference: 'salesforce.Opportunity.field.FormulaRef1__c', occurrences: [{ location: 'workato.recipe__code.instance.recipe5_code.block.0.block.0.input.customField__c', direction: 'input' }] },
          { reference: 'salesforce.Opportunity.field.FormulaRef2__c', occurrences: [{ location: 'workato.recipe__code.instance.recipe5_code.block.0.block.0.input.something1', direction: 'input' }] },
          { reference: 'salesforce.Opportunity.field.FormulaRef3__c', occurrences: [{ location: 'workato.recipe__code.instance.recipe5_code.block.0.block.0.input.something2', direction: 'input' }] },
        ])
      })
    })
  })
})
