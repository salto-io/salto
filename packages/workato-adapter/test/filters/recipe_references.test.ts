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
import filterCreator from '../../src/filters/cross_service/recipe_references'
import WorkatoClient from '../../src/client/client'
import { paginate } from '../../src/client/pagination'
import { DEFAULT_TYPES, DEFAULT_ID_FIELDS } from '../../src/config'
import { WORKATO } from '../../src/constants'

/* eslint-disable @typescript-eslint/camelcase */

describe('Recipe references filter', () => {
  let client: WorkatoClient
  type FilterType = filterUtils.FilterWith<'onPostFetch'>
  let filter: FilterType

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
            salesforce: 'salesforce sandbox 1',
            netsuite: 'netsuite sbx 123',
            ignoreThis: 'abc',
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
        id: { type: BuiltinTypes.NUMBER },
        application: { type: BuiltinTypes.STRING },
        name: { type: BuiltinTypes.STRING },
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

    const labelValueType = new ObjectType({
      elemID: new ElemID(WORKATO, 'labelValue'),
      fields: {
        label: { type: BuiltinTypes.STRING },
        value: { type: BuiltinTypes.STRING },
      },
    })

    const dynamicPickListSelectionType = new ObjectType({
      elemID: new ElemID(WORKATO, 'recipe__code__dynamicPickListSelection'),
      fields: {
        sobject_name: { type: BuiltinTypes.STRING },
        netsuite_object: { type: BuiltinTypes.STRING },
        topic_id: { type: BuiltinTypes.STRING },
        table_list: { type: new ListType(labelValueType) },
        field_list: { type: new ListType(labelValueType) },
      },
    })

    const inputType = new ObjectType({
      elemID: new ElemID(WORKATO, 'recipe__code__input'),
      fields: {
        sobject_name: { type: BuiltinTypes.STRING },
        netsuite_object: { type: BuiltinTypes.STRING },
        topic_id: { type: BuiltinTypes.STRING },
        table_list: { type: new ListType(labelValueType) },
        field_list: { type: new ListType(labelValueType) },
      },
    })

    // imitate 3-level recursive type generation until we fix it

    const nestedBlockTypeInner = new ObjectType({
      elemID: new ElemID(WORKATO, 'recipe__code__block__block__block'),
      fields: {
        provider: { type: BuiltinTypes.STRING },
        name: { type: BuiltinTypes.STRING },
        dynamicPickListSelection: { type: dynamicPickListSelectionType },
        input: { type: inputType },
      },
    })

    const nestedBlockType = new ObjectType({
      elemID: new ElemID(WORKATO, 'recipe__code__block__block'),
      fields: {
        provider: { type: BuiltinTypes.STRING },
        name: { type: BuiltinTypes.STRING },
        dynamicPickListSelection: { type: dynamicPickListSelectionType },
        input: { type: inputType },
        block: { type: new ListType(nestedBlockTypeInner) },
      },
    })

    const blockType = new ObjectType({
      elemID: new ElemID(WORKATO, 'recipe__code__block'),
      fields: {
        provider: { type: BuiltinTypes.STRING },
        name: { type: BuiltinTypes.STRING },
        dynamicPickListSelection: { type: dynamicPickListSelectionType },
        input: { type: inputType },
        block: { type: new ListType(nestedBlockType) },
      },
    })

    const codeType = new ObjectType({
      elemID: new ElemID(WORKATO, 'recipe__code'),
      fields: {
        provider: { type: BuiltinTypes.STRING },
        name: { type: BuiltinTypes.STRING },
        dynamicPickListSelection: { type: dynamicPickListSelectionType },
        input: { type: inputType },
        block: { type: new ListType(blockType) },
      },
    })

    const recipeConfigType = new ObjectType({
      elemID: new ElemID(WORKATO, 'recipe__config'),
      fields: {
        name: { type: BuiltinTypes.STRING },
        provider: { type: BuiltinTypes.STRING },
        account_id: { type: BuiltinTypes.NUMBER },
        keyword: { type: BuiltinTypes.STRING },
      },
    })

    const recipeType = new ObjectType({
      elemID: new ElemID(WORKATO, 'recipe'),
      fields: {
        code: { type: codeType },
        config: { type: recipeConfigType },
        applications: { type: new ListType(BuiltinTypes.STRING) },
        trigger_application: { type: BuiltinTypes.STRING },
        action_applications: { type: new ListType(BuiltinTypes.STRING) },
      },
    })

    const sharedRecipeCode = {
      provider: 'salesforce',
      name: 'updated_custom_object',
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
              provider: 'salesforce',
              name: 'updated_custom_object',
              dynamicPickListSelection: {
                sobject_name: 'My Custom',
              },
              input: {
                sobject_name: 'MyCustom__c',
                customField__c: 'something',
              },
            },
          ],
        },
      ],
    }

    const recipe1code = new InstanceElement('recipe1_code', codeType, _.cloneDeep(sharedRecipeCode))
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
    return [
      connectionType,
      sfSandbox1,
      anotherSfSandbox,
      netsuiteSandbox123,
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
    ]
  }

  const generateSalesforceElements = (): Element[] => {
    const opportunity = new ObjectType({
      elemID: new ElemID('salesforce', 'Opportunity'),
      fields: {
        Id: {
          type: BuiltinTypes.STRING,
          annotations: {
            apiName: 'Opportunity.Id',
          },
        },
        Custom__c: {
          type: BuiltinTypes.STRING,
          annotations: {
            apiName: 'Opportunity.Custom__c',
          },
        },
        Name: {
          type: BuiltinTypes.STRING,
          annotations: {
            apiName: 'Opportunity.Name',
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
      fields: {},
      annotations: {
        metadataType: 'CustomObject',
        apiName: 'User',
      },
    })
    const myCustom = new ObjectType({
      elemID: new ElemID('salesforce', 'MyCustom__c'),
      fields: {
        customField__c: { type: BuiltinTypes.NUMBER },
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

  describe('on post-fetch', () => {
    let currentAdapterElements: Element[]
    let salesforceElements: Element[]
    let netsuiteElements: Element[]
    let res: boolean

    beforeAll(async () => {
      currentAdapterElements = generateCurrentAdapterElements()
      salesforceElements = generateSalesforceElements()
      netsuiteElements = generateNetsuiteElements()
      res = await filter.onPostFetch({
        currentAdapterElements,
        elementsByAdapter: {
          salesforce: salesforceElements,
          netsuite: netsuiteElements,
        },
      })
    })

    describe('recipe1', () => {
      it('should show all resolved references in the _generated_dependencies annotation, in alphabetical order', () => {
        const recipeCode = currentAdapterElements.find(e => e.elemID.getFullName() === 'workato.recipe__code.instance.recipe1_code')
        expect(recipeCode).toBeDefined()
        expect(recipeCode?.annotations?.[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toBeDefined()
        expect(recipeCode?.annotations?.[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toHaveLength(12)
        expect(recipeCode?.annotations?.[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES].every(
          isReferenceExpression
        )).toBeTruthy()
        expect(recipeCode?.annotations?.[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES].map(
          (ref: ReferenceExpression) => ref.elemId.getFullName()
        )).toEqual([
          'netsuite.customrecordtype.instance.customrecord16',
          'netsuite.customrecordtype.instance.customrecord16.customrecordcustomfields.customrecordcustomfield.0',
          'netsuite.customrecordtype.instance.customrecord16.customrecordcustomfields.customrecordcustomfield.2',
          'netsuite.entitycustomfield.instance.custentitycustom_account_city',
          'netsuite.othercustomfield.instance.custrecord2',
          'salesforce.MyCustom__c',
          'salesforce.MyCustom__c.field.customField__c',
          'salesforce.Opportunity',
          'salesforce.Opportunity.field.Custom__c',
          'salesforce.Opportunity.field.Id',
          'salesforce.Opportunity.field.Name',
          'salesforce.User',
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
        expect(recipeCode.value.input.sobject_name.elemId.getFullName()).toEqual('salesforce.Opportunity')
        expect(recipeCode.value.dynamicPickListSelection.sobject_name).toBeInstanceOf(
          ReferenceExpression
        )
        expect(recipeCode.value.dynamicPickListSelection.sobject_name.elemId.getFullName()).toEqual('salesforce.Opportunity')
        expect(recipeCode.value.dynamicPickListSelection.field_list).toHaveLength(4)
        // some, but not all, references are resolved
        expect(
          recipeCode.value.dynamicPickListSelection.field_list.every(isReferenceExpression)
        ).toBeFalsy()
        expect(
          recipeCode.value.dynamicPickListSelection.field_list.some(isReferenceExpression)
        ).toBeTruthy()
        expect(recipeCode.value.dynamicPickListSelection.field_list[0].elemId.getFullName()).toEqual('salesforce.Opportunity.field.Id')
        expect(recipeCode.value.dynamicPickListSelection.field_list[1]).toEqual({ label: 'Account ID', value: 'AccountId' })
        expect(recipeCode.value.dynamicPickListSelection.field_list[2].elemId.getFullName()).toEqual('salesforce.Opportunity.field.Name')
        expect(recipeCode.value.dynamicPickListSelection.field_list[3].elemId.getFullName()).toEqual('salesforce.Opportunity.field.Custom__c')
        expect(recipeCode.value.dynamicPickListSelection.table_list).toHaveLength(3)
        // some, but not all, references are resolved
        expect(
          recipeCode.value.dynamicPickListSelection.table_list.every(isReferenceExpression)
        ).toBeFalsy()
        expect(
          recipeCode.value.dynamicPickListSelection.table_list.some(isReferenceExpression)
        ).toBeTruthy()
        expect(recipeCode.value.dynamicPickListSelection.table_list[0]).toEqual({ label: 'Price Book', value: 'Pricebook2' })
        expect(recipeCode.value.dynamicPickListSelection.table_list[1].elemId.getFullName()).toEqual('salesforce.User')
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
        expect(block1.input.netsuite_object.elemId.getFullName()).toEqual('netsuite.customrecordtype.instance.customrecord16')
        const block2 = block1.block[0]
        expect(block2.input.sobject_name).toBeInstanceOf(
          ReferenceExpression
        )
        expect(block2.input.sobject_name.elemId.getFullName()).toEqual('salesforce.MyCustom__c')
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
        expect(recipeCode?.annotations?.[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES].every(
          isReferenceExpression
        )).toBeTruthy()
        expect(recipeCode?.annotations?.[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES].map(
          (ref: ReferenceExpression) => ref.elemId.getFullName()
        )).toEqual([
          'netsuite.customrecordtype.instance.customrecord16',
          'netsuite.customrecordtype.instance.customrecord16.customrecordcustomfields.customrecordcustomfield.0',
          'netsuite.customrecordtype.instance.customrecord16.customrecordcustomfields.customrecordcustomfield.2',
          'netsuite.entitycustomfield.instance.custentitycustom_account_city',
          'netsuite.othercustomfield.instance.custrecord2',
        ])
      })

      it('should not resolve any salesforce references in-place', () => {
        const recipeCode = currentAdapterElements.find(
          e => e.elemID.getFullName() === 'workato.recipe__code.instance.recipe3_code'
        ) as InstanceElement
        expect(recipeCode).toBeInstanceOf(InstanceElement)
        expect(recipeCode.value.input.sobject_name).toEqual('Opportunity')
        expect(recipeCode.value.dynamicPickListSelection.sobject_name).toEqual('Opportunity')
        expect(recipeCode.value.dynamicPickListSelection.field_list).toHaveLength(4)
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
        expect(block1.input.netsuite_object.elemId.getFullName()).toEqual('netsuite.customrecordtype.instance.customrecord16')
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

    it('should return true if any element was changed', () => {
      expect(res).toBeTruthy()
    })
    it('should return false if no elements were modified', async () => {
      const elements = generateCurrentAdapterElements()
      expect(await filter.onPostFetch({
        currentAdapterElements: elements,
        elementsByAdapter: {
          salesforce: [],
          netsuite: [],
        },
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
              salesforce: 'salesforce sandbox 1 unresolved',
              netsuite: 'netsuite sbx 123',
              ignoreThis: 'abc',
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
      expect(await otherFilter.onPostFetch({
        currentAdapterElements: elements,
        elementsByAdapter: {
          salesforce: generateSalesforceElements(),
          netsuite: generateNetsuiteElements(),
        },
      })).toBeTruthy()
      expect(
        elements.filter(e => e.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES] !== undefined)
      ).toHaveLength(2)
      expect(
        elements
          .flatMap(e => e.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES] ?? [])
          .map(e => e.elemId.getFullName())
      ).toEqual([
        'netsuite.customrecordtype.instance.customrecord16',
        'netsuite.customrecordtype.instance.customrecord16.customrecordcustomfields.customrecordcustomfield.0',
        'netsuite.customrecordtype.instance.customrecord16.customrecordcustomfields.customrecordcustomfield.2',
        'netsuite.entitycustomfield.instance.custentitycustom_account_city',
        'netsuite.othercustomfield.instance.custrecord2',
        'netsuite.customrecordtype.instance.customrecord16',
        'netsuite.customrecordtype.instance.customrecord16.customrecordcustomfields.customrecordcustomfield.0',
        'netsuite.customrecordtype.instance.customrecord16.customrecordcustomfields.customrecordcustomfield.2',
        'netsuite.entitycustomfield.instance.custentitycustom_account_city',
        'netsuite.othercustomfield.instance.custrecord2',
      ])
    })
  })
})
