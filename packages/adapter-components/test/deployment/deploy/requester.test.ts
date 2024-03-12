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
import {
  BuiltinTypes,
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ObjectType,
  getChangeData,
  toChange,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { types } from '@salto-io/lowerdash'
import { mockFunction, MockInterface } from '@salto-io/test-utils'
import { HTTPReadClientInterface, HTTPWriteClientInterface } from '../../../src/client/http_client'
import { getRequester } from '../../../src/deployment/deploy/requester'
import { ApiDefinitions, queryWithDefault } from '../../../src/definitions'
import { noPagination } from '../../../src/fetch/request/pagination'

describe('DeployRequester', () => {
  let type: ObjectType
  let instance: InstanceElement
  let client: MockInterface<HTTPWriteClientInterface & HTTPReadClientInterface>
  let definitions: types.PickyRequired<ApiDefinitions<'main', 'none', 'activate' | 'deactivate'>, 'clients' | 'deploy'>

  beforeEach(() => {
    type = new ObjectType({
      elemID: new ElemID('adapter', 'test'),
      fields: {
        id: { refType: BuiltinTypes.STRING },
        creatableField: {
          refType: BuiltinTypes.STRING,
          annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
        },
      },
    })

    instance = new InstanceElement('instance', type, {
      creatableField: 'creatableValue',
      ignored: 'ignored',
    })

    client = {
      post: mockFunction<HTTPWriteClientInterface['post']>(),
      put: mockFunction<HTTPWriteClientInterface['put']>(),
      delete: mockFunction<HTTPWriteClientInterface['delete']>(),
      patch: mockFunction<HTTPWriteClientInterface['patch']>(),
      getPageSize: mockFunction<HTTPReadClientInterface['getPageSize']>(),
      get: mockFunction<HTTPReadClientInterface['get']>(),
      head: mockFunction<HTTPReadClientInterface['head']>(),
      options: mockFunction<HTTPReadClientInterface['options']>(),
    }

    definitions = {
      clients: {
        default: 'main',
        options: {
          main: {
            httpClient: client,
            endpoints: {
              customizations: {},
            },
          },
        },
      },
      pagination: {
        none: {
          funcCreator: noPagination,
        },
      },
      deploy: {
        instances: {
          customizations: {
            test: {
              requestsByAction: {
                customizations: {
                  add: [
                    {
                      request: {
                        endpoint: {
                          path: '/test/endpoint',
                          method: 'post',
                        },
                      },
                    },
                  ],
                  remove: [
                    {
                      request: {
                        context: {
                          instanceId: '{obj.id}',
                        },
                        endpoint: {
                          path: '/test/endpoint/{instanceId}',
                          method: 'delete',
                        },
                      },
                    },
                  ],
                },
              },
            },
            multi_test: {
              requestsByAction: {
                customizations: {
                  add: [
                    {
                      request: {
                        endpoint: {
                          path: '/ep1',
                          method: 'post',
                        },
                      },
                    },
                    {
                      request: {
                        endpoint: {
                          path: '/ep2',
                          method: 'patch',
                        },
                      },
                      copyFromResponse: {
                        pick: ['stop'],
                      },
                    },
                    {
                      condition: {
                        custom:
                          () =>
                          ({ change }) =>
                            getChangeData(change).value.stop !== true,
                      },
                      request: {
                        endpoint: {
                          path: '/ep3',
                        },
                      },
                    },
                  ],
                  modify: [
                    {
                      condition: {
                        skipIfIdentical: false,
                      },
                      request: {
                        endpoint: {
                          path: '/ep1',
                          method: 'post',
                        },
                      },
                    },
                    {
                      request: {
                        endpoint: {
                          path: '/ep2',
                          method: 'patch',
                        },
                      },
                      copyFromResponse: {
                        pick: ['stop'],
                      },
                    },
                    {
                      condition: {
                        skipIfIdentical: false,
                      },
                      request: {
                        endpoint: {
                          path: '/ep3',
                          method: 'post',
                        },
                      },
                    },
                    {
                      condition: {
                        skipIfIdentical: false,
                      },
                      request: {
                        earlySuccess: true,
                      },
                    },
                    {
                      condition: {
                        skipIfIdentical: false,
                      },
                      request: {
                        endpoint: {
                          path: '/ep4',
                          method: 'post',
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
  })

  // TODO extend (these cases are from the old infra deployChange tests)

  it('When no endpoint for deploying the element should throw an error', async () => {
    const requester = getRequester({
      clients: definitions.clients,
      deployDefQuery: queryWithDefault(definitions.deploy.instances),
      changeResolver: async change => change,
    })
    const change = toChange({ before: instance, after: instance })
    await expect(() =>
      requester.requestAllForChangeAndAction({
        action: change.action,
        change,
        changeGroup: { changes: [change], groupID: 'abc' },
        elementSource: buildElementsSourceFromElements([]),
      }),
    ).rejects.toThrow('Could not find requests for change adapter.test.instance.instance action modify')
  })

  it('deleting an instance should send the instance id to the right URL', async () => {
    client.delete.mockResolvedValue({
      status: 200,
      data: {},
    })
    const requester = getRequester({
      clients: definitions.clients,
      deployDefQuery: queryWithDefault(definitions.deploy.instances),
      changeResolver: async change => change,
    })
    instance.value.obj = { id: 1 }
    const change = toChange({ before: instance })
    await requester.requestAllForChangeAndAction({
      action: change.action,
      change,
      changeGroup: { changes: [change], groupID: 'abc' },
      elementSource: buildElementsSourceFromElements([]),
    })
    expect(instance.value.obj.id).toBe(1)
    expect(client.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/test/endpoint/1',
      }),
    )
  })

  it('should not send ignored fields', async () => {
    client.post.mockResolvedValue({
      status: 200,
      data: {},
    })
    const defs: (typeof definitions)['deploy']['instances'] = _.merge({}, definitions.deploy.instances, {
      customizations: {
        test: {
          requestsByAction: {
            customizations: {
              add: [
                {
                  request: {
                    transformation: {
                      // TODO the "old infra" test had a fieldsToIgnore recursive function - this can now be done using adjust
                      omit: ['ignored'],
                    },
                  },
                },
              ],
            },
          },
        },
      },
    })
    const requester = getRequester({
      clients: definitions.clients,
      deployDefQuery: queryWithDefault(defs),
      changeResolver: async change => change,
    })
    const change = toChange({ after: instance })
    await requester.requestAllForChangeAndAction({
      action: change.action,
      change,
      changeGroup: { changes: [change], groupID: 'abc' },
      elementSource: buildElementsSourceFromElements([]),
    })

    expect(client.post).toHaveBeenCalledWith({
      url: '/test/endpoint',
      data: {
        creatableField: 'creatableValue',
      },
    })
  })

  it('should omit request body when deploy request config contains omitRequestBody=true', async () => {
    client.delete.mockResolvedValue({
      status: 200,
      data: {},
    })

    instance.value.id = '1'
    _.set(definitions.clients.options.main.endpoints, 'default.delete.omitBody', true)
    _.set(
      definitions.deploy.instances.customizations,
      'test.requestsByAction.customizations.remove[0].request.context.instanceId',
      '{id}',
    )
    const requester = getRequester({
      clients: definitions.clients,
      deployDefQuery: queryWithDefault(definitions.deploy.instances),
      changeResolver: async change => change,
    })
    const change = toChange({ before: instance })
    await requester.requestAllForChangeAndAction({
      action: change.action,
      change,
      changeGroup: { changes: [change], groupID: 'abc' },
      elementSource: buildElementsSourceFromElements([]),
    })
    expect(client.delete).toHaveBeenCalledWith({ url: '/test/endpoint/1', data: undefined, queryParams: undefined })
  })

  it('should include request body when deploy request config contains omitRequestBody=false', async () => {
    client.delete.mockResolvedValue({
      status: 200,
      data: {},
    })

    instance.value.id = '1'
    _.set(definitions.clients.options.main.endpoints, 'default.delete.omitBody', false)
    _.set(
      definitions.deploy.instances.customizations,
      'test.requestsByAction.customizations.remove[0].request.context.instanceId',
      '{id}',
    )
    const requester = getRequester({
      clients: definitions.clients,
      deployDefQuery: queryWithDefault(definitions.deploy.instances),
      changeResolver: async change => change,
    })
    const change = toChange({ before: instance })
    await requester.requestAllForChangeAndAction({
      action: change.action,
      change,
      changeGroup: { changes: [change], groupID: 'abc' },
      elementSource: buildElementsSourceFromElements([]),
    })
    expect(client.delete).toHaveBeenCalledWith({
      url: '/test/endpoint/1',
      data: { id: '1', creatableField: 'creatableValue', ignored: 'ignored' },
      queryParams: undefined,
    })
  })
  // TODO add tests for allowed status codes once SALTO-5415 is merged

  it('should support multiple requests', async () => {
    client.post.mockResolvedValueOnce({
      status: 200,
      data: {
        id: 'NEW',
      },
    })
    client.patch.mockResolvedValueOnce({
      status: 200,
      data: {},
    })
    client.get.mockResolvedValue({
      status: 200,
      data: {},
    })
    const requester = getRequester({
      clients: definitions.clients,
      deployDefQuery: queryWithDefault(definitions.deploy.instances),
      changeResolver: async change => change,
    })
    const change = toChange({
      after: new InstanceElement(
        'bla',
        new ObjectType({
          elemID: new ElemID('bla', 'multi_test'),
          fields: { id: { refType: BuiltinTypes.SERVICE_ID } },
        }),
      ),
    })
    await requester.requestAllForChangeAndAction({
      action: change.action,
      change,
      changeGroup: { changes: [change], groupID: 'abc' },
      elementSource: buildElementsSourceFromElements([]),
    })
    expect(getChangeData(change).value.id).toBe('NEW')
    expect(client.post).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/ep1',
      }),
    )
    expect(client.patch).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/ep2',
      }),
    )
    expect(client.get).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/ep3',
      }),
    )
  })

  it('should run the correct request flow for the action and stop when a custom condition is not met', async () => {
    client.post.mockResolvedValue({
      status: 200,
      data: {},
    })
    client.patch.mockResolvedValue({
      status: 200,
      data: {
        stop: true,
      },
    })
    client.get.mockResolvedValue({
      status: 200,
      data: {},
    })

    const requester = getRequester({
      clients: definitions.clients,
      deployDefQuery: queryWithDefault(definitions.deploy.instances),
      changeResolver: async change => change,
    })
    const change = toChange({
      after: new InstanceElement(
        'bla',
        new ObjectType({
          elemID: new ElemID('bla', 'multi_test'),
          fields: { id: { refType: BuiltinTypes.SERVICE_ID } },
        }),
      ),
    })
    await requester.requestAllForChangeAndAction({
      action: change.action,
      change,
      changeGroup: { changes: [change], groupID: 'abc' },
      elementSource: buildElementsSourceFromElements([]),
    })
    expect(getChangeData(change).value.stop).toBe(true)
    expect(client.post).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/ep1',
      }),
    )
    expect(client.patch).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/ep2',
      }),
    )
    expect(client.get).not.toHaveBeenCalled()
  })
  it('should run the correct request flow for the action and check skipIfIdentical at the individual request level, and stop on earlySuccess', async () => {
    client.post.mockResolvedValue({
      status: 200,
      data: {},
    })
    client.patch.mockResolvedValue({
      status: 200,
      data: {
        stop: true,
      },
    })

    const requester = getRequester({
      clients: definitions.clients,
      deployDefQuery: queryWithDefault(definitions.deploy.instances),
      changeResolver: async change => change,
    })
    const inst = new InstanceElement(
      'bla',
      new ObjectType({
        elemID: new ElemID('bla', 'multi_test'),
        fields: { id: { refType: BuiltinTypes.SERVICE_ID } },
      }),
    )
    const change = toChange({
      before: inst,
      after: inst,
    })
    await requester.requestAllForChangeAndAction({
      action: change.action,
      change,
      changeGroup: { changes: [change], groupID: 'abc' },
      elementSource: buildElementsSourceFromElements([]),
    })
    expect(client.post).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/ep1',
      }),
    )
    expect(client.patch).not.toHaveBeenCalled()
    expect(client.post).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/ep3',
      }),
    )
    expect(client.post).not.toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/ep4',
      }),
    )
  })
})
