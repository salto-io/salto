/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import {
  InstanceElement,
  isInstanceElement,
  ReferenceExpression,
  ObjectType,
  ElemID,
  CORE_ANNOTATIONS,
  AdapterOperations,
  toChange,
  BuiltinTypes,
  ListType,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { types } from '@salto-io/lowerdash'
import mockReplies from './mock_replies.json'
import { adapter } from '../src/adapter_creator'
import { usernameTokenCredentialsType } from '../src/auth'
import { configType, getDefaultConfig, FETCH_CONFIG, API_DEFINITIONS_CONFIG } from '../src/config'
import {
  CONNECTION_TYPE,
  DEPLOY_USING_RLM_GROUP,
  FOLDER_TYPE,
  RECIPE_CODE_TYPE,
  RECIPE_CONFIG_TYPE,
  RECIPE_TYPE,
  WORKATO,
} from '../src/constants'
import { RLMDeploy } from '../src/rlm'

type MockReply = {
  url: string
  params: Record<string, string>
  response: unknown
}

jest.mock('../src/rlm', () => {
  const orig = jest.requireActual('../src/rlm')
  return {
    ...orig,
    RLMDeploy: jest.fn(),
  }
})

describe('adapter', () => {
  let mockAxiosAdapter: MockAdapter

  beforeEach(async () => {
    mockAxiosAdapter = new MockAdapter(axios, { delayResponse: 1, onNoMatch: 'throwException' })
    mockAxiosAdapter
      .onGet('/users/me', undefined, expect.objectContaining({ Authorization: 'Bearer token456' }))
      .reply(200, {
        id: 'user123',
      })
    ;(mockReplies as MockReply[]).forEach(({ url, params, response }) => {
      mockAxiosAdapter.onGet(url, !_.isEmpty(params) ? { params } : undefined).replyOnce(200, response)
    })
  })

  afterEach(() => {
    mockAxiosAdapter.restore()
  })

  describe('fetch and postFetch', () => {
    describe('full fetch', () => {
      it('should generate the right elements on fetch', async () => {
        const { elements } = await adapter
          .operations({
            credentials: new InstanceElement('config', usernameTokenCredentialsType, { token: 'token456' }),
            config: new InstanceElement('config', configType, getDefaultConfig()),
            elementsSource: buildElementsSourceFromElements([]),
          })
          .fetch({ progressReporter: { reportProgress: () => null } })
        expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual([
          'workato.api_access_profile',
          'workato.api_access_profile.instance.ap1',
          'workato.api_client',
          'workato.api_client.instance.test_client_1@s',
          'workato.api_collection',
          'workato.api_collection.instance.test1',
          'workato.api_endpoint',
          'workato.api_endpoint.instance.ep321__somedomainname_test1_v10_user__id_@uddbdd_00123_00125',
          'workato.connection',
          'workato.connection.instance.HTTP_connection_1@s',
          'workato.connection.instance.My_Gmail_connection@s',
          'workato.connection.instance.My_Google_sheets_connection@s',
          'workato.connection.instance.Test_NetSuite_account@s',
          'workato.connection.instance.dev2_sfdc_account@s',
          'workato.connection.instance.sfdev1',
          'workato.folder',
          'workato.folder.instance.Root',
          'workato.folder.instance.basedir1_Root',
          'workato.folder.instance.f1_nested1_basedir1_Root',
          'workato.folder.instance.f1_nested2_basedir1_Root@vuu',
          'workato.folder.instance.f1n2_leaf1_f1_nested2_basedir1_Root_vuu@suuuum',
          'workato.property',
          'workato.property.instance',
          'workato.recipe',
          'workato.recipe.instance.Copy_of_New_email_in_Gmail_will_add_a_new_row_in_Google_Sheets_f1_nested2_basedir1_Root_vuu@sssssssssssssuuuum',
          'workato.recipe.instance.Copy_of_New_or_updated_standard_record___________in_NetSuite__will_create_record_in_Salesforce_f1n2_leaf1_f1_nested2_basedir1_Root_vuu_suuuum@ssssss_00010sssssssssss_00010sssssuuuuuuum',
          'workato.recipe.instance.Copy_of_New_updated_record_in_Salesforce_will_add_a_new_row_in_a_sheet_in_Google_Sheets_f1_nested2_basedir1_Root_vuu@ssdssssssssssssssuuuum',
          'workato.recipe.instance.Copy_of_pubsub_recipe_412_f1n2_leaf1_f1_nested2_basedir1_Root_vuu_suuuum@ssssuuuuuuum',
          'workato.recipe.instance.Copy_of_test_recipe_321_f1n2_leaf1_f1_nested2_basedir1_Root_vuu_suuuum@ssssuuuuuuum',
          'workato.recipe.instance.Empty_recipe_f1_nested2_basedir1_Root_vuu@suuuum',
          'workato.recipe.instance.New_updated_record_in_Salesforce_will_add_a_new_row_in_a_sheet_in_Google_Sheets_f1_nested2_basedir1_Root_vuu@dssssssssssssssuuuum',
          'workato.recipe.instance.__________New_or_updated_standard_record___________in_NetSuite__will_create_record_in_Salesforce_f1_nested2_basedir1_Root_vuu@ssssssssssssss_00010sssssssssss_00010sssssuuuum',
          'workato.recipe.instance.pubsub_recipe_412_basedir1_Root@ssuu',
          'workato.recipe.instance.test_recipe_321_f1_nested2_basedir1_Root_vuu@ssuuuum',
          'workato.recipe__code',
          'workato.recipe__code.instance.Copy_of_New_email_in_Gmail_will_add_a_new_row_in_Google_Sheets_f1_nested2_basedir1_Root_vuu_sssssssssssssuuuum@uuuuuuuuuuuuuuuuuum',
          'workato.recipe__code.instance.Copy_of_New_or_updated_standard_record___________in_NetSuite__will_create_record_in_Salesforce_f1n2_leaf1_f1_nested2_basedir1_Root_vuu_suuuum_ssssss_00010sssssssssss_00010sssssuuuuuuum@uuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuumuu',
          'workato.recipe__code.instance.Copy_of_New_updated_record_in_Salesforce_will_add_a_new_row_in_a_sheet_in_Google_Sheets_f1_nested2_basedir1_Root_vuu_ssdssssssssssssssuuuum@uuuuuuuuuuuuuuuuuuuuuum',
          'workato.recipe__code.instance.Copy_of_pubsub_recipe_412_f1n2_leaf1_f1_nested2_basedir1_Root_vuu_suuuum_ssssuuuuuuum@uuuuuuuuuuuum',
          'workato.recipe__code.instance.Copy_of_test_recipe_321_f1n2_leaf1_f1_nested2_basedir1_Root_vuu_suuuum_ssssuuuuuuum@uuuuuuuuuuuum',
          'workato.recipe__code.instance.New_updated_record_in_Salesforce_will_add_a_new_row_in_a_sheet_in_Google_Sheets_f1_nested2_basedir1_Root_vuu_dssssssssssssssuuuum@uuuuuuuuuuuuuuuuuuuum',
          'workato.recipe__code.instance.__________New_or_updated_standard_record___________in_NetSuite__will_create_record_in_Salesforce_f1_nested2_basedir1_Root_vuu_ssssssssssssss_00010sssssssssss_00010sssssuuuum@uuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuumuu',
          'workato.recipe__code.instance.pubsub_recipe_412_basedir1_Root_ssuu@uuuum',
          'workato.recipe__code.instance.test_recipe_321_f1_nested2_basedir1_Root_vuu_ssuuuum@uuuuuuum',
          'workato.recipe__code__block',
          'workato.recipe__code__block__block',
          'workato.recipe__code__block__block__dynamicPickListSelection',
          'workato.recipe__code__block__block__extended_input_schema',
          'workato.recipe__code__block__block__extended_input_schema__properties',
          'workato.recipe__code__block__block__input',
          'workato.recipe__code__block__block__input__columns',
          'workato.recipe__code__block__block__toggleCfg',
          'workato.recipe__code__block__dynamicPickListSelection',
          'workato.recipe__code__block__extended_input_schema',
          'workato.recipe__code__block__extended_input_schema__properties',
          'workato.recipe__code__block__input',
          'workato.recipe__code__block__input__conditions',
          'workato.recipe__code__block__input__data',
          'workato.recipe__code__block__input__message',
          'workato.recipe__code__block__requirements',
          'workato.recipe__code__block__requirements__extended_input_schema',
          'workato.recipe__code__block__requirements__extended_input_schema__properties',
          'workato.recipe__code__block__toggleCfg',
          'workato.recipe__code__dynamicPickListSelection',
          'workato.recipe__code__dynamicPickListSelection__field_list',
          'workato.recipe__code__dynamicPickListSelection__table_list',
          'workato.recipe__code__extended_input_schema',
          'workato.recipe__code__extended_input_schema__toggle_field',
          'workato.recipe__code__extended_output_schema',
          'workato.recipe__code__extended_output_schema__properties',
          'workato.recipe__code__extended_output_schema__properties__pick_list_params',
          'workato.recipe__code__extended_output_schema__properties__properties',
          'workato.recipe__code__extended_output_schema__properties__properties__pick_list_params',
          'workato.recipe__code__extended_output_schema__properties__properties__properties',
          'workato.recipe__code__extended_output_schema__properties__properties__toggle_field',
          'workato.recipe__code__extended_output_schema__properties__toggle_field',
          'workato.recipe__code__extended_output_schema__toggle_field',
          'workato.recipe__code__filter',
          'workato.recipe__code__filter__conditions',
          'workato.recipe__code__input',
          'workato.recipe__code__toggleCfg',
          'workato.recipe__config',
          'workato.recipe__parameters',
          'workato.role',
        ])

        const folder = elements
          .filter(isInstanceElement)
          .find(e => e.elemID.getFullName() === 'workato.folder.instance.f1_nested1_basedir1_Root')
        expect(folder).toBeDefined()
        expect(folder?.value).toEqual({
          id: 300507,
          name: 'f1_nested1',
          // eslint-disable-next-line camelcase
          parent_id: expect.any(ReferenceExpression),
        })
        expect(folder?.value.parent_id.elemID.getFullName()).toEqual('workato.folder.instance.basedir1_Root')

        const recipe = elements
          .filter(isInstanceElement)
          .find(
            e =>
              e.elemID.getFullName() ===
              'workato.recipe.instance.New_updated_record_in_Salesforce_will_add_a_new_row_in_a_sheet_in_Google_Sheets_f1_nested2_basedir1_Root_vuu@dssssssssssssssuuuum',
          )
        expect(recipe).toBeDefined()
        expect(recipe?.value).toEqual({
          id: 1209425,
          // eslint-disable-next-line camelcase
          user_id: 191676,
          name: 'New/updated record in Salesforce will add a new row in a sheet in Google Sheets',
          // eslint-disable-next-line camelcase
          trigger_application: 'salesforce',
          // eslint-disable-next-line camelcase
          action_applications: ['google_sheets'],
          applications: ['salesforce', 'google_sheets'],
          description: 'When there is a new/updated record in Salesforce, add a new row in a sheet in Google Sheets',
          running: false,
          config: [
            {
              keyword: 'application',
              name: 'salesforce',
              provider: 'salesforce',
              // eslint-disable-next-line camelcase
              account_id: expect.any(ReferenceExpression),
            },
            {
              keyword: 'application',
              name: 'google_sheets',
              provider: 'google_sheets',
              // eslint-disable-next-line camelcase
              account_id: expect.any(ReferenceExpression),
            },
          ],
          code: expect.any(ReferenceExpression),
          folder_id: expect.any(ReferenceExpression),
        })
        expect(recipe?.value.folder_id.elemID.getFullName()).toEqual(
          'workato.folder.instance.f1_nested2_basedir1_Root@vuu',
        )
        const recipeCodeReference = recipe?.value.code
        expect(recipeCodeReference).toBeInstanceOf(ReferenceExpression)
        expect((recipeCodeReference as ReferenceExpression).elemID.getFullName()).toEqual(
          'workato.recipe__code.instance.New_updated_record_in_Salesforce_will_add_a_new_row_in_a_sheet_in_Google_Sheets_f1_nested2_basedir1_Root_vuu_dssssssssssssssuuuum@uuuuuuuuuuuuuuuuuuuum',
        )
        const recipeCode = elements
          .filter(isInstanceElement)
          .find(
            e =>
              e.elemID.getFullName() ===
              'workato.recipe__code.instance.New_updated_record_in_Salesforce_will_add_a_new_row_in_a_sheet_in_Google_Sheets_f1_nested2_basedir1_Root_vuu_dssssssssssssssuuuum@uuuuuuuuuuuuuuuuuuuum',
          )
        expect(recipeCode).toBeDefined()
        expect(recipeCode?.value).toEqual({
          number: 0,
          provider: 'salesforce',
          name: 'updated_custom_object',
          as: 'c859b8f9',
          title: 'New/updated Opportunity',
          description:
            'New/updated <span class="provider">Opportunity</span> in <span class="provider">Salesforce</span>',
          keyword: 'trigger',
          dynamicPickListSelection: expect.anything(),
          input: {
            // eslint-disable-next-line camelcase
            sobject_name: 'Opportunity',
            // eslint-disable-next-line camelcase
            since_offset: '-3600',
          },
          // eslint-disable-next-line camelcase
          visible_config_fields: ['sobject_name', 'since_offset'],
          // eslint-disable-next-line camelcase
          hidden_config_fields: ['field_list'],
          block: expect.anything(),
          uuid: '12345678-1234-1234-1234-1234567890ab',
        })
      })
      it('should filter elements by type+name on fetch', async () => {
        const { elements } = await adapter
          .operations({
            credentials: new InstanceElement('config', usernameTokenCredentialsType, { token: 'token456' }),
            config: new InstanceElement('config', configType, {
              ...getDefaultConfig(),
              fetch: {
                ...getDefaultConfig().fetch,
                include: [{ type: '(?!recipe$).*' }, { type: 'recipe', criteria: { name: 'test.*' } }],
              },
            }),
            elementsSource: buildElementsSourceFromElements([]),
          })
          .fetch({ progressReporter: { reportProgress: () => null } })

        expect(
          elements
            .filter(isInstanceElement)
            .map(e => e.elemID.getFullName())
            .sort(),
        ).toEqual([
          'workato.api_access_profile.instance.ap1',
          'workato.api_client.instance.test_client_1@s',
          'workato.api_collection.instance.test1',
          'workato.api_endpoint.instance.ep321__somedomainname_test1_v10_user__id_@uddbdd_00123_00125',
          'workato.connection.instance.HTTP_connection_1@s',
          'workato.connection.instance.My_Gmail_connection@s',
          'workato.connection.instance.My_Google_sheets_connection@s',
          'workato.connection.instance.Test_NetSuite_account@s',
          'workato.connection.instance.dev2_sfdc_account@s',
          'workato.connection.instance.sfdev1',
          'workato.folder.instance.Root',
          'workato.folder.instance.basedir1_Root',
          'workato.folder.instance.f1_nested1_basedir1_Root',
          'workato.folder.instance.f1_nested2_basedir1_Root@vuu',
          'workato.folder.instance.f1n2_leaf1_f1_nested2_basedir1_Root_vuu@suuuum',
          'workato.property.instance',
          'workato.recipe.instance.test_recipe_321_f1_nested2_basedir1_Root_vuu@ssuuuum',
          'workato.recipe__code.instance.test_recipe_321_f1_nested2_basedir1_Root_vuu_ssuuuum@uuuuuuum',
        ])
      })
    })

    describe('type overrides', () => {
      it('should fetch only the relevant types', async () => {
        const { elements } = await adapter
          .operations({
            credentials: new InstanceElement('config', usernameTokenCredentialsType, { token: 'token456' }),
            config: new InstanceElement('config', configType, {
              [FETCH_CONFIG]: {
                include: [{ type: 'connection' }],
                exclude: [],
              },
              [API_DEFINITIONS_CONFIG]: {
                types: {
                  connection: {
                    request: {
                      url: '/connections',
                    },
                  },
                },
              },
            }),
            elementsSource: buildElementsSourceFromElements([]),
          })
          .fetch({ progressReporter: { reportProgress: () => null } })
        expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual([
          'workato.api_access_profile',
          'workato.api_client',
          'workato.api_collection',
          'workato.api_endpoint',
          'workato.connection',
          'workato.connection.instance.HTTP_connection_1@s',
          'workato.connection.instance.My_Gmail_connection@s',
          'workato.connection.instance.My_Google_sheets_connection@s',
          'workato.connection.instance.Test_NetSuite_account@s',
          'workato.connection.instance.dev2_sfdc_account@s',
          'workato.connection.instance.sfdev1',
          'workato.folder',
          'workato.property',
          'workato.recipe',
          'workato.recipe__code',
          'workato.role',
        ])
      })
      it('should use elemIdGetter', async () => {
        const sfdev1ConnectionId = 1234
        const operations = adapter.operations({
          credentials: new InstanceElement('config', usernameTokenCredentialsType, { token: 'token456' }),
          config: new InstanceElement('config', configType, {
            [FETCH_CONFIG]: {
              include: [{ type: 'connection' }],
              exclude: [],
            },
            [API_DEFINITIONS_CONFIG]: {
              types: {
                connection: {
                  request: {
                    url: '/connections',
                  },
                },
              },
            },
          }),
          elementsSource: buildElementsSourceFromElements([]),
          getElemIdFunc: (adapterName, serviceIds, name) => {
            if (Number(serviceIds.id) === sfdev1ConnectionId) {
              return new ElemID(adapterName, 'connection', 'instance', 'sfdev1')
            }
            return new ElemID(adapterName, name)
          },
        })
        const { elements } = await operations.fetch({ progressReporter: { reportProgress: () => null } })
        const instances = elements.filter(isInstanceElement)
        expect(instances).toHaveLength(6)
        expect(instances.map(e => e.elemID.getFullName()).sort()).toEqual([
          'workato.connection.instance.HTTP_connection_1@s',
          'workato.connection.instance.My_Gmail_connection@s',
          'workato.connection.instance.My_Google_sheets_connection@s',
          'workato.connection.instance.Test_NetSuite_account@s',
          'workato.connection.instance.dev2_sfdc_account@s',
          'workato.connection.instance.sfdev1',
        ])
        const response = [
          {
            id: sfdev1ConnectionId,
            name: 'sfdev1 - edited',
          },
        ]
        mockAxiosAdapter.onGet('/connections').replyOnce(200, response)
        const { elements: newElements } = await operations.fetch({ progressReporter: { reportProgress: () => null } })
        const newInstances = newElements.filter(isInstanceElement)
        expect(newInstances.map(e => e.elemID.getFullName()).sort()).toEqual(['workato.connection.instance.sfdev1'])
      })
    })

    describe('with postFetch', () => {
      it('should have references in recipe__code instances', async () => {
        const fishCustomObject = new ObjectType({
          elemID: new ElemID('salesforce', 'Fish__c'),
          fields: {},
          annotations: {
            metadataType: 'CustomObject',
            apiName: 'Fish__c',
            label: 'Fish',
          },
        })
        const fishCustomObject2 = new ObjectType({
          elemID: new ElemID('salesforce2', 'Fish__c'),
          fields: {},
          annotations: {
            metadataType: 'CustomObject',
            apiName: 'Fish__c',
            label: 'Fish',
          },
        })

        const adapterOperations = adapter.operations({
          credentials: new InstanceElement('config', usernameTokenCredentialsType, { token: 'token456' }),
          config: new InstanceElement('config', configType, {
            [FETCH_CONFIG]: {
              ...getDefaultConfig()[FETCH_CONFIG],
              serviceConnectionNames: {
                salesforce: ['sfdev1'],
                salesforce2: ['dev2 sfdc account'],
                netsuite: ['Test NetSuite account'],
              },
            },
          }),
          elementsSource: buildElementsSourceFromElements([]),
        }) as types.PickyRequired<AdapterOperations, 'postFetch'>
        const fetchResult = await adapterOperations.fetch({
          progressReporter: { reportProgress: () => null },
        })
        const currentAdapterElements = fetchResult.elements
        expect(adapterOperations.postFetch).toBeDefined()
        await adapterOperations.postFetch({
          currentAdapterElements,
          elementsByAccount: {
            salesforce: [fishCustomObject],
            salesforce2: [fishCustomObject2],
          },
          accountToServiceNameMap: {
            netsuite: 'netsuite',
            salesforce: 'salesforce',
            salesforce2: 'salesforce',
          },
          progressReporter: { reportProgress: () => null },
        })
        const recipeCodeWithRefs = currentAdapterElements
          .filter(isInstanceElement)
          .find(e => e.elemID.getFullName().startsWith('workato.recipe__code.instance.pubsub_recipe_412'))
        expect(recipeCodeWithRefs).toBeDefined()
        const deps = recipeCodeWithRefs?.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]
        expect(deps).toBeDefined()
        expect(deps).toHaveLength(1)
        expect(deps[0].reference).toBeInstanceOf(ReferenceExpression)
        expect(deps[0].reference.elemID.getFullName()).toEqual('salesforce.Fish__c')
      })
    })
  })

  describe('deploy', () => {
    let mockRLMDeploy: jest.MockedFunction<typeof RLMDeploy>
    let operations: AdapterOperations
    let recipe: InstanceElement
    let recipeCode: InstanceElement
    let connection: InstanceElement
    let rootFolder: InstanceElement
    let folderRecipes: InstanceElement
    let folderConnection: InstanceElement

    const labelType = new ObjectType({
      elemID: new ElemID(WORKATO, 'labelValue'),
      fields: {
        label: { refType: BuiltinTypes.STRING },
      },
    })

    const dynamicPickListSelectionType = new ObjectType({
      elemID: new ElemID(WORKATO, 'recipe__code__dynamicPickListSelection'),
      fields: {
        sobject_name: { refType: BuiltinTypes.STRING },
        netsuite_object: { refType: BuiltinTypes.STRING },
        topic_id: { refType: BuiltinTypes.STRING },
        table_list: { refType: new ListType(labelType) },
        field_list: { refType: new ListType(labelType) },
      },
    })

    const connectionType = new ObjectType({
      elemID: new ElemID(WORKATO, CONNECTION_TYPE),
      fields: {
        id: { refType: BuiltinTypes.NUMBER, annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true } },
        folder_id: { refType: BuiltinTypes.NUMBER },
      },
    })
    const recipeType = new ObjectType({
      elemID: new ElemID(WORKATO, RECIPE_TYPE),
      fields: {
        id: { refType: BuiltinTypes.NUMBER, annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true } },
        folder_id: { refType: BuiltinTypes.NUMBER },
        code: { refType: BuiltinTypes.UNKNOWN },
        config: {
          refType: new ListType(
            new ObjectType({
              elemID: new ElemID(WORKATO, RECIPE_CONFIG_TYPE),
              fields: {
                account_id: { refType: BuiltinTypes.NUMBER },
              },
            }),
          ),
        },
      },
    })
    const recipeCodeType = new ObjectType({
      elemID: new ElemID(WORKATO, RECIPE_CODE_TYPE),
      fields: {
        dynamicPickListSelection: {
          refType: dynamicPickListSelectionType,
        },
      },
    })
    const folderType = new ObjectType({
      elemID: new ElemID(WORKATO, FOLDER_TYPE),
      fields: {
        id: { refType: BuiltinTypes.NUMBER, annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true } },
        // eslint-disable-next-line camelcase
        parent_id: { refType: BuiltinTypes.NUMBER },
      },
    })

    beforeEach(() => {
      mockRLMDeploy = RLMDeploy as jest.MockedFunction<typeof RLMDeploy>
      mockRLMDeploy.mockClear()
      mockRLMDeploy.mockImplementation(async changes => ({ appliedChanges: changes, errors: [] }))

      operations = adapter.operations({
        credentials: new InstanceElement('config', usernameTokenCredentialsType, { token: 'token456' }),
        config: new InstanceElement('config', configType, getDefaultConfig(true)),
        elementsSource: buildElementsSourceFromElements([]),
      })
      rootFolder = new InstanceElement('rootFolder', folderType, { id: 98 })
      folderRecipes = new InstanceElement('innerFolder1InstanceName', folderType, {
        parent_id: new ReferenceExpression(rootFolder.elemID, rootFolder),
        name: 'innerFolder1',
      })
      folderConnection = new InstanceElement('innerFolder2InstanceName', folderType, {
        parent_id: new ReferenceExpression(rootFolder.elemID, rootFolder),
        name: 'innerFolder2',
      })
      connection = new InstanceElement('connectionInstanceName', connectionType, {
        folder_id: new ReferenceExpression(folderConnection.elemID, folderConnection),
      })
      recipe = new InstanceElement('recipe1InstanceName', recipeType)
      recipeCode = new InstanceElement('recipe1CodeInstanceName', recipeCodeType, { block: 'block' }, undefined, {
        [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(recipe.elemID, recipe),
      })

      recipe.value = {
        folder_id: new ReferenceExpression(folderRecipes.elemID, folderRecipes),
        config: [{ account_id: new ReferenceExpression(connection.elemID, connection) }],
        code: new ReferenceExpression(recipeCode.elemID, recipeCode),
      }
    })

    it('should return the applied changes', async () => {
      const beforeRecipe = _.cloneDeep(recipe)
      beforeRecipe.value.before = true
      const deployRes = await operations.deploy({
        changeGroup: {
          groupID: DEPLOY_USING_RLM_GROUP,
          changes: [
            toChange({
              before: beforeRecipe,
              after: _.cloneDeep(recipe),
            }),
            toChange({ after: _.cloneDeep(recipeCode) }),
            toChange({ after: _.cloneDeep(connection) }),
          ],
        },
        progressReporter: {
          reportProgress(): void {
            throw new Error('Function not implemented.')
          },
        },
      })
      expect(deployRes.errors).toHaveLength(0)
      expect(deployRes.appliedChanges).toEqual([
        toChange({
          before: _.cloneDeep(beforeRecipe),
          after: _.cloneDeep(recipe),
        }),
        toChange({ after: _.cloneDeep(recipeCode) }),
        toChange({ after: _.cloneDeep(connection) }),
      ])
    })

    describe('deploy connection', () => {
      let resolvedConnection: InstanceElement
      beforeEach(() => {
        resolvedConnection = _.cloneDeep(connection)
        resolvedConnection.value.folder_id = {
          folderParts: ['innerFolder2'],
          rootId: 98,
        }
      })
      it('should call RLMDeploy with the resolved connection', async () => {
        await operations.deploy({
          changeGroup: {
            groupID: DEPLOY_USING_RLM_GROUP,
            changes: [toChange({ after: _.cloneDeep(connection) })],
          },
          progressReporter: {
            reportProgress(): void {
              throw new Error('Function not implemented.')
            },
          },
        })
        expect(mockRLMDeploy).toHaveBeenCalledWith([toChange({ after: resolvedConnection })], expect.anything())
      })
    })

    describe('deploy non InFolder group change', () => {
      const nonInFolderType = new ObjectType({ elemID: new ElemID(WORKATO, 'nonRLM') })

      it('should throw not implemented', async () => {
        const AdditionChange = toChange({
          after: new InstanceElement('inst1', nonInFolderType),
        })
        await expect(
          operations.deploy({
            changeGroup: { groupID: 'not InFolder', changes: [AdditionChange] },
            progressReporter: {
              reportProgress(): void {
                throw new Error('Function not implemented.')
              },
            },
          }),
        ).rejects.toThrow()

        const ModificationChange = toChange({
          before: new InstanceElement('inst2', nonInFolderType),
          after: new InstanceElement('inst2', nonInFolderType),
        })
        await expect(
          operations.deploy({
            changeGroup: { groupID: 'not InFolder', changes: [ModificationChange] },
            progressReporter: {
              reportProgress(): void {
                throw new Error('Function not implemented.')
              },
            },
          }),
        ).rejects.toThrow()
      })
    })
  })
})
