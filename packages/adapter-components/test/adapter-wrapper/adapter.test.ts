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
  Adapter,
  AdapterOperations,
  Change,
  DeployResult,
  ElemID,
  getChangeData,
  InstanceElement,
  isInstanceElement,
  ObjectType,
  ProgressReporter,
  toChange,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { types } from '@salto-io/lowerdash'
import { createAdapter } from '../../src/adapter-wrapper/adapter_creator'
import { ApiDefinitions, HTTPMethod, UserConfig } from '../../src/definitions'
import { createStandardItemDeployDefinition } from '../../src/deployment/definition_helpers'
import { noPagination } from '../../src/fetch/request/pagination'
import { axiosConnection } from '../../src/client'
import { defaultCredentialsFromConfig } from '../../src/credentials'
import { INCLUDE_ALL_CONFIG } from '../../src/fetch/query'
// to update mock file -
// for fetch: run fetch with trace-level logs:
//  > SALTO_LOG_FILE=log.txt SALTO_LOG_LEVEL=trace salto fetch
// then run
//  > python3 <path-to-repo>/packages/adapter-components/scripts/client/mock_replies.py <log file> fetch_mock_replies.json
// for deploy: same as above, replace fetch with deploy
// make sure to minimize and sanitize the mocks - they may contain sensitive information!
import fetchMockReplies from './fetch_mock_replies.json'
import deployMockReplies from './deploy_mock_replies.json'

const nullProgressReporter: ProgressReporter = {
  reportProgress: () => '',
}

type MockReply = {
  url: string
  method: HTTPMethod
  params?: Record<string, string>
  response: unknown
}

const getMockFunction = (method: HTTPMethod, mockAxiosAdapter: MockAdapter): MockAdapter['onAny'] => {
  switch (method.toLowerCase()) {
    case 'get':
      return mockAxiosAdapter.onGet
    case 'put':
      return mockAxiosAdapter.onPut
    case 'post':
      return mockAxiosAdapter.onPost
    case 'patch':
      return mockAxiosAdapter.onPatch
    case 'delete':
      return mockAxiosAdapter.onDelete
    case 'head':
      return mockAxiosAdapter.onHead
    case 'options':
      return mockAxiosAdapter.onOptions
    default:
      return mockAxiosAdapter.onGet
  }
}

const DEFAULT_CONFIG: UserConfig = {
  client: {},
  fetch: {
    ...INCLUDE_ALL_CONFIG,
  },
}

describe('createAdapter', () => {
  jest.setTimeout(10 * 1000)
  let mockAxiosAdapter: MockAdapter
  let definitions: Omit<types.PickyRequired<ApiDefinitions, 'fetch'>, 'clients'>
  let credentialsType: ObjectType
  let adapter: Adapter

  beforeEach(async () => {
    mockAxiosAdapter = new MockAdapter(axios, { delayResponse: 1, onNoMatch: 'throwException' })
    // TODO replace with endpoint used in validateCredentials
    mockAxiosAdapter.onGet('/api/v2/account').reply(200)
    ;([...fetchMockReplies, ...deployMockReplies] as MockReply[]).forEach(({ url, method, params, response }) => {
      const mock = getMockFunction(method, mockAxiosAdapter).bind(mockAxiosAdapter)
      const handler = mock(url, !_.isEmpty(params) ? { params } : undefined)
      handler.replyOnce(200, response)
    })
    definitions = {
      pagination: {
        none: {
          funcCreator: noPagination,
        },
      },
      fetch: {
        instances: {
          default: {
            resource: {
              serviceIDFields: ['id'],
            },
            element: {
              topLevel: {
                elemID: { parts: [{ fieldName: 'name' }] },
              },
            },
          },
          customizations: {
            group: {
              requests: [
                {
                  endpoint: {
                    path: '/api/v2/groups',
                  },
                  transformation: {
                    root: 'groups',
                  },
                },
              ],
              resource: {
                // this type can be included/excluded based on the user's fetch query
                directFetch: true,
              },
              element: {
                topLevel: {
                  // isTopLevel should be set when the workspace can have instances of this type
                  isTopLevel: true,
                  serviceUrl: {
                    path: '/some/path/to/group/with/potential/placeholder/{id}',
                  },
                },
                fieldCustomizations: {
                  id: {
                    fieldType: 'number',
                    hide: true,
                  },
                },
              },
            },
            business_hours_schedule: {
              requests: [
                {
                  endpoint: {
                    path: '/api/v2/business_hours/schedules',
                  },
                  transformation: {
                    root: 'schedules',
                  },
                },
              ],
              resource: {
                directFetch: true,
                // after we get the business_hour_schedule response, we make a follow-up request to get
                // the holiday and nest the response under the 'holidays' field
                recurseInto: {
                  holidays: {
                    typeName: 'business_hours_schedule_holiday',
                    context: {
                      args: {
                        parent_id: {
                          fromField: 'id',
                        },
                      },
                    },
                  },
                },
              },
              element: {
                topLevel: {
                  isTopLevel: true,
                  serviceUrl: {
                    path: '/admin/objects-rules/rules/schedules',
                  },
                },
                fieldCustomizations: {
                  id: {
                    fieldType: 'number',
                    hide: true,
                  },
                  holidays: {
                    // extract each item in the holidays field to its own instance
                    standalone: {
                      typeName: 'business_hours_schedule_holiday',
                      addParentAnnotation: true,
                      referenceFromParent: false,
                      nestPathUnderParent: true,
                    },
                  },
                },
              },
            },
            business_hours_schedule_holiday: {
              requests: [
                {
                  endpoint: {
                    path: '/api/v2/business_hours/schedules/{parent_id}/holidays',
                  },
                  transformation: {
                    root: 'holidays',
                  },
                },
              ],
              element: {
                topLevel: {
                  isTopLevel: true,
                  elemID: { extendsParent: true },
                },
                fieldCustomizations: {
                  id: {
                    fieldType: 'number',
                    hide: true,
                  },
                },
              },
            },
          },
        },
      },
      deploy: {
        instances: {
          customizations: {
            group: createStandardItemDeployDefinition({ bulkPath: '/api/v2/groups', nestUnderField: 'group' }),
            business_hours_schedule: {
              requestsByAction: {
                customizations: {
                  add: [
                    {
                      request: {
                        endpoint: {
                          path: '/api/v2/business_hours/schedules',
                          method: 'post',
                        },
                        transformation: {
                          nestUnderField: 'schedule',
                        },
                      },
                      copyFromResponse: {
                        root: 'schedule',
                      },
                    },
                    {
                      condition: {
                        // skipIfIdentical is true by default
                        transformForCheck: {
                          pick: ['intervals'],
                        },
                      },
                      request: {
                        endpoint: {
                          path: '/api/v2/business_hours/schedules/{id}/workweek',
                          method: 'put',
                        },
                        transformation: {
                          pick: ['intervals'],
                          nestUnderField: 'workweek',
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    }

    adapter = createAdapter({
      adapterName: 'test',
      initialClients: { main: undefined },
      authenticationMethods: { basic: { credentialsType } },
      defaultConfig: DEFAULT_CONFIG,
      definitionsCreator: ({ clients }) => ({
        ...definitions,
        clients: {
          options: {
            main: {
              httpClient: clients.main,
              endpoints: {
                default: {
                  get: {
                    readonly: true,
                  },
                },
                customizations: {},
              },
            },
          },
          default: 'main',
        },
      }),
      operationsCustomizations: {
        connectionCreatorFromConfig: () => () =>
          axiosConnection({
            authParamsFunc: async () => ({}),
            baseURLFunc: async () => 'https://localhost:80',
            credValidateFunc: async () => ({ accountId: 'abc' }),
            retryOptions: {},
          }),
        credentialsFromConfig: defaultCredentialsFromConfig,
      },
    })
  })

  afterEach(() => {
    mockAxiosAdapter.restore()
    jest.clearAllMocks()
  })

  describe('fetch', () => {
    describe('full', () => {
      it('should generate the right elements on fetch', async () => {
        credentialsType = new ObjectType({ elemID: new ElemID('test') })
        expect(adapter.configType).toBeDefined()
        const { elements } = await adapter
          .operations({
            credentials: new InstanceElement('config', credentialsType, {
              // TODO adjust
              username: 'user',
              password: 'pass',
              subdomain: 'SOME_SUBDOMAIN',
            }),
            config: new InstanceElement('config', adapter.configType as ObjectType, DEFAULT_CONFIG),
            elementsSource: buildElementsSourceFromElements([]),
          })
          .fetch({ progressReporter: { reportProgress: () => null } })

        expect([...new Set(elements.filter(isInstanceElement).map(e => e.elemID.typeName))].sort()).toEqual([
          'business_hours_schedule',
          'business_hours_schedule_holiday',
          'group',
        ])
        expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual([
          'test.business_hours_schedule',
          'test.business_hours_schedule.instance.Some_schedule@s',
          'test.business_hours_schedule__intervals',
          'test.business_hours_schedule_holiday',
          'test.business_hours_schedule_holiday.instance.Some_schedule__New_holiday1@suus',
          'test.group',
          'test.group.instance.group_1@s',
          'test.group.instance.group_2@s',
        ])
        expect(
          elements
            .filter(isInstanceElement)
            .find(
              e =>
                e.elemID.getFullName() ===
                'test.business_hours_schedule_holiday.instance.Some_schedule__New_holiday1@suus',
            )?.value,
        ).toEqual({
          end_date: '2024-02-21',
          id: 4442618333587,
          name: 'New holiday1',
          start_date: '2024-02-20',
        })
      })

      describe('deploy', () => {
        let operations: AdapterOperations
        let groupType: ObjectType
        let businessHoursScheduleType: ObjectType
        let group1: InstanceElement
        let schedule1: InstanceElement

        beforeEach(() => {
          // TODO update to relevant changes
          groupType = new ObjectType({ elemID: new ElemID('test', 'group') })
          businessHoursScheduleType = new ObjectType({ elemID: new ElemID('test', 'business_hours_schedule') })
          group1 = new InstanceElement('group1', groupType, { name: 'group1', is_public: 'false', id: 1234 })
          schedule1 = new InstanceElement('My_Schedule@s', businessHoursScheduleType, {
            name: 'My Schedule',
            time_zone: 'Pacific Time (US & Canada)',
            intervals: [
              {
                start_time: 1980,
                end_time: 2460,
              },
              {
                start_time: 3420,
                end_time: 3900,
              },
              {
                start_time: 4860,
                end_time: 5340,
              },
              {
                start_time: 6300,
                end_time: 6780,
              },
              {
                start_time: 7740,
                end_time: 8220,
              },
            ],
          })

          operations = adapter.operations({
            credentials: new InstanceElement('config', credentialsType, {
              username: 'user123',
              password: 'pwd456',
              subdomain: 'myBrand',
            }),
            config: new InstanceElement('config', adapter.configType as ObjectType, DEFAULT_CONFIG),
            elementsSource: buildElementsSourceFromElements([groupType, businessHoursScheduleType, group1, schedule1]),
          })
        })

        it('should return the applied changes', async () => {
          const results: DeployResult[] = []
          results.push(
            await operations.deploy({
              changeGroup: {
                groupID: 'group',
                changes: [toChange({ after: new InstanceElement('new_group@s', groupType, { name: 'new group' }) })],
              },
              progressReporter: nullProgressReporter,
            }),
          )
          const updatedGroup1 = group1.clone()
          updatedGroup1.value.name = 'new name'
          results.push(
            await operations.deploy({
              changeGroup: {
                groupID: 'group',
                changes: [
                  toChange({
                    before: group1,
                    after: updatedGroup1,
                  }),
                ],
              },
              progressReporter: nullProgressReporter,
            }),
          )

          results.push(
            await operations.deploy({
              changeGroup: {
                groupID: 'group',
                changes: [
                  toChange({
                    after: new InstanceElement('schedule2', businessHoursScheduleType, {
                      name: 'schedule2',
                      time_zone: 'Pacific Time (US & Canada)',
                      intervals: [
                        {
                          start_time: 1980,
                          end_time: 2460,
                        },
                        {
                          start_time: 3420,
                          end_time: 3900,
                        },
                      ],
                    }),
                  }),
                ],
              },
              progressReporter: nullProgressReporter,
            }),
          )

          expect(results.map(res => res.appliedChanges.length)).toEqual([1, 1, 1])
          expect(results.map(res => res.errors.length)).toEqual([0, 0, 0])
          const addRes = results[0].appliedChanges[0] as Change<InstanceElement>
          expect(getChangeData(addRes).value.id).toEqual(12345)
        })
      })
    })
  })
})
