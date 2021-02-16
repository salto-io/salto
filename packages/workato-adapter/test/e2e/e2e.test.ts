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
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import { InstanceElement, isObjectType, isInstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { readTextFile } from '@salto-io/file'
import { adapter } from '../../src/adapter_creator'
import { usernameTokenCredentialsType } from '../../src/auth'
import { configType, FETCH_CONFIG, DEFAULT_ENDPOINTS } from '../../src/config'

const getMockReplies = async (): Promise<{
  url: string
  params: Record<string, string>
  response: unknown
}[]> => {
  // TODO improve path
  const replyDefs = (await readTextFile(`${__dirname.replace('/dist', '')}/mock_replies.jsonl`)).split('\n')
  const parsedDefs = replyDefs.filter(def => !_.isEmpty(def)).map(def => JSON.parse(def))
  return parsedDefs
}

describe('adapter creator', () => {
  let mockAxiosAdapter: MockAdapter
  beforeEach(async () => {
    mockAxiosAdapter = new MockAdapter(axios, { delayResponse: 1, onNoMatch: 'throwException' })
    mockAxiosAdapter.onGet(
      '/users/me', undefined, expect.objectContaining({ 'x-user-email': 'user123', 'x-user-token': 'token456' }),
    ).reply(200, {
      id: 'user123',
    })
    const mockReplies = await getMockReplies()
    mockReplies.forEach(({ url, params, response }) => {
      mockAxiosAdapter.onGet(url, !_.isEmpty(params) ? { params } : undefined).replyOnce(
        200, response
      )
    })
  })

  afterEach(() => {
    mockAxiosAdapter.restore()
  })

  it('should generate the right elements', async () => {
    const { elements } = await adapter.operations({
      credentials: new InstanceElement(
        'config',
        usernameTokenCredentialsType,
        { username: 'user123', token: 'token456' },
      ),
      config: new InstanceElement(
        'config',
        configType,
        {
          [FETCH_CONFIG]: {
            includeEndpoints: [...Object.keys(DEFAULT_ENDPOINTS)].sort(),
          },
        }
      ),
      elementsSource: buildElementsSourceFromElements([]),
    }).fetch({ progressReporter: { reportProgress: () => null } })
    expect(elements).toHaveLength(74)
    expect(elements.filter(isObjectType)).toHaveLength(49)
    expect(elements.filter(isInstanceElement)).toHaveLength(25)
    expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual([
      'workato.api_access_profile',
      'workato.api_access_profile.instance.ap1',
      'workato.api_client',
      'workato.api_client.instance.test_client_1@s',
      'workato.api_collection',
      'workato.api_collection.instance.test1',
      'workato.api_endpoint',
      'workato.api_endpoint.instance.ep321',
      'workato.connection',
      'workato.connection.instance.HTTP_connection_1@s',
      'workato.connection.instance.My_Gmail_connection@s',
      'workato.connection.instance.My_Google_sheets_connection@s',
      'workato.connection.instance.Test_NetSuite_account@s',
      'workato.connection.instance.dev2_sfdc_account@s',
      'workato.connection.instance.sfdev1',
      'workato.folder',
      'workato.folder.instance.basedir1',
      'workato.folder.instance.f1_nested1',
      'workato.folder.instance.f1_nested2@v',
      'workato.folder.instance.f1n2_leaf1@s',
      'workato.property',
      'workato.property.instance.unnamed_0',
      'workato.recipe',
      'workato.recipe.instance.New_email_in_Gmail_will_add_a_new_row_in_Google_Sheets@s',
      'workato.recipe.instance.New_updated_record_in_Salesforce_will_add_a_new_row_in_a_sheet_in_Google_Sheets@dssssssssssssss',
      'workato.recipe.instance.__________New_or_updated_standard_record___________in_NetSuite__will_create_record_in_Salesforce@ssssssssssssss_00010sssssssssss_00010sssss',
      'workato.recipe.instance.pubsub_recipe_412@s',
      'workato.recipe.instance.test_recipe_321@s',
      'workato.recipe__code',
      'workato.recipe__code.instance.new_email__New_email_in_Gmail_will_add_a_new_row_in_Google_Sheets_s@uuuuuuuuuuuuuum',
      'workato.recipe__code.instance.receive_request__test_recipe_321_s@uuuuum',
      'workato.recipe__code.instance.subscribe_to_topic__pubsub_recipe_412_s@uuuuuum',
      'workato.recipe__code.instance.updated_custom_object__New_updated_record_in_Salesforce_will_add_a_new_row_in_a_sheet_in_Google_Sheets_dssssssssssssss@uuuuuuuuuuuuuuuuuuum',
      'workato.recipe__code.instance.updated_object____________New_or_updated_standard_record___________in_NetSuite__will_create_record_in_Salesforce_ssssssssssssss_00010sssssssssss_00010sssss@uuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuumuu',
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

    const folder = elements.filter(isInstanceElement).find(e => e.elemID.getFullName() === 'workato.folder.instance.f1_nested1')
    expect(folder).toBeDefined()
    expect(folder?.value).toEqual({
      id: 300507,
      name: 'f1_nested1',
      // eslint-disable-next-line @typescript-eslint/camelcase
      parent_id: {
        elemId: {
          adapter: 'workato',
          typeName: 'folder',
          idType: 'instance',
          nameParts: ['basedir1'],
        },
      },
    })

    const recipe = elements.filter(isInstanceElement).find(e => e.elemID.getFullName() === 'workato.recipe.instance.New_updated_record_in_Salesforce_will_add_a_new_row_in_a_sheet_in_Google_Sheets@dssssssssssssss')
    expect(recipe).toBeDefined()
    expect(recipe?.value).toEqual({
      id: 1209425,
      // eslint-disable-next-line @typescript-eslint/camelcase
      user_id: 191676,
      name: 'New/updated record in Salesforce will add a new row in a sheet in Google Sheets',
      // eslint-disable-next-line @typescript-eslint/camelcase
      copy_count: 1,
      // eslint-disable-next-line @typescript-eslint/camelcase
      trigger_application: 'salesforce',
      // eslint-disable-next-line @typescript-eslint/camelcase
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
          // eslint-disable-next-line @typescript-eslint/camelcase
          account_id: expect.any(ReferenceExpression),
        },
        {
          keyword: 'application',
          name: 'google_sheets',
          provider: 'google_sheets',
          // eslint-disable-next-line @typescript-eslint/camelcase
          account_id: expect.any(ReferenceExpression),
        },
      ],
      code: expect.any(ReferenceExpression),
    })
    const recipeCodeReference = recipe?.value.code
    expect(recipeCodeReference).toBeInstanceOf(ReferenceExpression)
    expect((recipeCodeReference as ReferenceExpression).elemId.getFullName()).toEqual('workato.recipe__code.instance.updated_custom_object__New_updated_record_in_Salesforce_will_add_a_new_row_in_a_sheet_in_Google_Sheets_dssssssssssssss@uuuuuuuuuuuuuuuuuuum')
    const recipeCode = elements.filter(isInstanceElement).find(e => e.elemID.getFullName() === 'workato.recipe__code.instance.updated_custom_object__New_updated_record_in_Salesforce_will_add_a_new_row_in_a_sheet_in_Google_Sheets_dssssssssssssss@uuuuuuuuuuuuuuuuuuum')
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
        // eslint-disable-next-line @typescript-eslint/camelcase
        sobject_name: 'Opportunity',
        // eslint-disable-next-line @typescript-eslint/camelcase
        since_offset: '-3600',
      },
      // eslint-disable-next-line @typescript-eslint/camelcase
      extended_output_schema: expect.anything(),
      // eslint-disable-next-line @typescript-eslint/camelcase
      extended_input_schema: expect.anything(),
      // eslint-disable-next-line @typescript-eslint/camelcase
      visible_config_fields: [
        'sobject_name',
        'since_offset',
      ],
      // eslint-disable-next-line @typescript-eslint/camelcase
      hidden_config_fields: [
        'field_list',
      ],
      block: expect.anything(),
      uuid: '12345678-1234-1234-1234-1234567890ab',
    })
  })
})
