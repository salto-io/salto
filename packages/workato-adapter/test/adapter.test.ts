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
import _ from 'lodash'
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import { InstanceElement, isObjectType, isInstanceElement, ReferenceExpression, ObjectType, ElemID, CORE_ANNOTATIONS, AdapterOperations } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { types } from '@salto-io/lowerdash'
import mockReplies from './mock_replies.json'
import { adapter } from '../src/adapter_creator'
import { usernameTokenCredentialsType } from '../src/auth'
import { configType, FETCH_CONFIG, DEFAULT_TYPES, API_DEFINITIONS_CONFIG } from '../src/config'
import { RECIPE_CODE_TYPE } from '../src/constants'

type MockReply = {
  url: string
  params: Record<string, string>
  response: unknown
}

describe('adapter', () => {
  let mockAxiosAdapter: MockAdapter

  beforeEach(async () => {
    mockAxiosAdapter = new MockAdapter(axios, { delayResponse: 1, onNoMatch: 'throwException' })
    mockAxiosAdapter.onGet(
      '/users/me', undefined, expect.objectContaining({ Authorization: 'Bearer token456' }),
    ).reply(200, {
      id: 'user123',
    });
    (mockReplies as MockReply[]).forEach(({ url, params, response }) => {
      mockAxiosAdapter.onGet(url, !_.isEmpty(params) ? { params } : undefined).replyOnce(
        200, response
      )
    })
  })

  afterEach(() => {
    mockAxiosAdapter.restore()
  })

  describe('fetch and postFetch', () => {
    describe('full fetch', () => {
      it('should generate the right elements on fetch', async () => {
        const { elements } = await adapter.operations({
          credentials: new InstanceElement(
            'config',
            usernameTokenCredentialsType,
            { token: 'token456' },
          ),
          config: new InstanceElement(
            'config',
            configType,
            {
              [FETCH_CONFIG]: {
                include: [...Object.keys(DEFAULT_TYPES)].sort()
                  .filter(type => type !== RECIPE_CODE_TYPE)
                  .map(type => ({ type })),
                exclude: [],
              },
            }
          ),
          elementsSource: buildElementsSourceFromElements([]),
        }).fetch({ progressReporter: { reportProgress: () => null } })
        expect(elements).toHaveLength(85)
        expect(elements.filter(isObjectType)).toHaveLength(49)
        expect(elements.filter(isInstanceElement)).toHaveLength(36)
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
          'workato.recipe.instance.New_email_in_Gmail_will_add_a_new_row_in_Google_Sheets_f1_nested2_basedir1_Root_vuu@sssssssssssuuuum',
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
          'workato.recipe__code.instance.New_email_in_Gmail_will_add_a_new_row_in_Google_Sheets_f1_nested2_basedir1_Root_vuu_sssssssssssuuuum@uuuuuuuuuuuuuuuum',
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

        const folder = elements.filter(isInstanceElement).find(e => e.elemID.getFullName() === 'workato.folder.instance.f1_nested1_basedir1_Root')
        expect(folder).toBeDefined()
        expect(folder?.value).toEqual({
          id: 300507,
          name: 'f1_nested1',
          // eslint-disable-next-line camelcase
          parent_id: expect.any(ReferenceExpression),
        })
        expect(folder?.value.parent_id.elemID.getFullName()).toEqual('workato.folder.instance.basedir1_Root')

        const recipe = elements.filter(isInstanceElement).find(e => e.elemID.getFullName() === 'workato.recipe.instance.New_updated_record_in_Salesforce_will_add_a_new_row_in_a_sheet_in_Google_Sheets_f1_nested2_basedir1_Root_vuu@dssssssssssssssuuuum')
        expect(recipe).toBeDefined()
        expect(recipe?.value).toEqual({
          id: 1209425,
          // eslint-disable-next-line camelcase
          user_id: 191676,
          name: 'New/updated record in Salesforce will add a new row in a sheet in Google Sheets',
          // eslint-disable-next-line camelcase
          trigger_application: 'salesforce',
          // eslint-disable-next-line camelcase
          action_applications: [
            'google_sheets',
          ],
          applications: [
            'salesforce',
            'google_sheets',
          ],
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
        expect(recipe?.value.folder_id.elemID.getFullName()).toEqual('workato.folder.instance.f1_nested2_basedir1_Root@vuu')
        const recipeCodeReference = recipe?.value.code
        expect(recipeCodeReference).toBeInstanceOf(ReferenceExpression)
        expect((recipeCodeReference as ReferenceExpression).elemID.getFullName()).toEqual('workato.recipe__code.instance.New_updated_record_in_Salesforce_will_add_a_new_row_in_a_sheet_in_Google_Sheets_f1_nested2_basedir1_Root_vuu_dssssssssssssssuuuum@uuuuuuuuuuuuuuuuuuuum')
        const recipeCode = elements.filter(isInstanceElement).find(e => e.elemID.getFullName() === 'workato.recipe__code.instance.New_updated_record_in_Salesforce_will_add_a_new_row_in_a_sheet_in_Google_Sheets_f1_nested2_basedir1_Root_vuu_dssssssssssssssuuuum@uuuuuuuuuuuuuuuuuuuum')
        expect(recipeCode).toBeDefined()
        expect(recipeCode?.value).toEqual({
          number: 0,
          provider: 'salesforce',
          name: 'updated_custom_object',
          as: 'c859b8f9',
          title: 'New/updated Opportunity',
          description: 'New/updated <span class="provider">Opportunity</span> in <span class="provider">Salesforce</span>',
          keyword: 'trigger',
          dynamicPickListSelection: expect.anything(),
          input: {
            // eslint-disable-next-line camelcase
            sobject_name: 'Opportunity',
            // eslint-disable-next-line camelcase
            since_offset: '-3600',
          },
          // eslint-disable-next-line camelcase
          visible_config_fields: [
            'sobject_name',
            'since_offset',
          ],
          // eslint-disable-next-line camelcase
          hidden_config_fields: [
            'field_list',
          ],
          block: expect.anything(),
          uuid: '12345678-1234-1234-1234-1234567890ab',
        })
      })
    })

    describe('type overrides', () => {
      it('should fetch only the relevant types', async () => {
        const { elements } = await adapter.operations({
          credentials: new InstanceElement(
            'config',
            usernameTokenCredentialsType,
            { token: 'token456' },
          ),
          config: new InstanceElement(
            'config',
            configType,
            {
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
            },
          ),
          elementsSource: buildElementsSourceFromElements([]),
        }).fetch({ progressReporter: { reportProgress: () => null } })
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
          credentials: new InstanceElement(
            'config',
            usernameTokenCredentialsType,
            { token: 'token456' },
          ),
          config: new InstanceElement(
            'config',
            configType,
            {
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
            },
          ),
          elementsSource: buildElementsSourceFromElements([]),
          getElemIdFunc: (adapterName, serviceIds, name) => {
            if (Number(serviceIds.id) === sfdev1ConnectionId) {
              return new ElemID(adapterName, 'connection', 'instance', 'sfdev1')
            }
            return new ElemID(adapterName, name)
          },
        })
        const { elements } = await operations
          .fetch({ progressReporter: { reportProgress: () => null } })
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
        const { elements: newElements } = await operations
          .fetch({ progressReporter: { reportProgress: () => null } })
        const newInstances = newElements.filter(isInstanceElement)
        expect(newInstances.map(e => e.elemID.getFullName()).sort()).toEqual([
          'workato.connection.instance.sfdev1',
        ])
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
          credentials: new InstanceElement(
            'config',
            usernameTokenCredentialsType,
            { token: 'token456' },
          ),
          config: new InstanceElement(
            'config',
            configType,
            {
              [FETCH_CONFIG]: {
                include: [...Object.keys(DEFAULT_TYPES)].sort()
                  .filter(type => type !== RECIPE_CODE_TYPE)
                  .map(type => ({ type })),
                exclude: [],
                serviceConnectionNames: {
                  salesforce: ['sfdev1'],
                  salesforce2: ['dev2 sfdc account'],
                  netsuite: ['Test NetSuite account'],
                },
              },
            }
          ),
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
        const recipeCodeWithRefs = currentAdapterElements.filter(isInstanceElement).find(e => e.elemID.getFullName().startsWith('workato.recipe__code.instance.pubsub_recipe_412'))
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
    it('should throw not implemented', async () => {
      const operations = adapter.operations({
        credentials: new InstanceElement(
          'config',
          usernameTokenCredentialsType,
          { token: 'token456' },
        ),
        config: new InstanceElement(
          'config',
          configType,
          {
            include: [...Object.keys(DEFAULT_TYPES)].sort()
              .filter(type => type !== RECIPE_CODE_TYPE)
              .map(type => ({ type })),
            exclude: [],
          }
        ),
        elementsSource: buildElementsSourceFromElements([]),
      })
      await expect(operations.deploy({ changeGroup: { groupID: '', changes: [] } })).rejects.toThrow(new Error('Not implemented.'))
    })
  })
})
