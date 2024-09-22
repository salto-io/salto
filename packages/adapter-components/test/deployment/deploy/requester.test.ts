/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  BuiltinTypes,
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ObjectType,
  getChangeData,
  isModificationChange,
  toChange,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { types } from '@salto-io/lowerdash'
import { mockFunction, MockInterface } from '@salto-io/test-utils'
import { HTTPError, HTTPReadClientInterface, HTTPWriteClientInterface } from '../../../src/client/http_client'
import { getRequester } from '../../../src/deployment/deploy/requester'
import { ApiDefinitions, queryWithDefault } from '../../../src/definitions'
import { noPagination } from '../../../src/fetch/request/pagination'
import { Response, ResponseValue } from '../../../src/client'

type AdditionalAction = 'activate' | 'deactivate'

describe('DeployRequester', () => {
  let type: ObjectType
  let instance: InstanceElement
  let client: MockInterface<HTTPWriteClientInterface & HTTPReadClientInterface>
  let definitions: types.PickyRequired<ApiDefinitions<{ additionalAction: AdditionalAction }>, 'clients' | 'deploy'>

  beforeEach(() => {
    type = new ObjectType({
      elemID: new ElemID('adapter', 'test'),
      fields: {
        id: { refType: BuiltinTypes.SERVICE_ID },
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
              default: {
                delete: {
                  additionalValidStatuses: [404],
                  polling: {
                    interval: 100,
                    retries: 3,
                    checkStatus: (response: Response<ResponseValue | ResponseValue[]>): boolean =>
                      response.status !== 502,
                  },
                },
              },
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
                          queryArgs: {
                            instanceId: '{instanceId}',
                          },
                          path: '/test/endpoint/{instanceId}',
                          method: 'delete',
                        },
                      },
                    },
                  ],
                },
              },
            },
            test2: {
              requestsByAction: {
                customizations: {
                  modify: [
                    {
                      request: {
                        context: {
                          custom:
                            () =>
                            ({ change }) => {
                              if (!isModificationChange(change)) {
                                return {}
                              }
                              return {
                                oldInstanceId: change.data.before.value.obj.id,
                              }
                            },
                        },
                        endpoint: {
                          path: '/test2/endpoint/{oldInstanceId}',
                          method: 'put',
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
                        additional: {
                          pick: ['stop'],
                        },
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
                        additional: {
                          pick: ['stop'],
                        },
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
    const requester = getRequester<{ additionalAction: AdditionalAction }>({
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
        sharedContext: {},
        errors: {},
      }),
    ).rejects.toThrow('Could not find requests for change adapter.test.instance.instance action modify')
  })

  it('should use context in URL and queryParams', async () => {
    client.delete.mockResolvedValue({
      status: 200,
      data: {},
    })
    const requester = getRequester<{ additionalAction: AdditionalAction }>({
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
      sharedContext: {},
      errors: {},
    })
    expect(instance.value.obj.id).toBe(1)
    expect(client.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/test/endpoint/1',
        queryParams: { instanceId: '1' },
      }),
    )
  })
  it('should use custom context in URL', async () => {
    client.put.mockResolvedValue({
      status: 200,
      data: {},
    })
    const requester = getRequester<{ additionalAction: AdditionalAction }>({
      clients: definitions.clients,
      deployDefQuery: queryWithDefault(definitions.deploy.instances),
      changeResolver: async change => change,
    })
    const beforeInstance = new InstanceElement('inst', new ObjectType({ elemID: new ElemID('adapter', 'test2') }), {
      obj: { id: 5 },
    })
    const afterInstance = beforeInstance.clone()
    afterInstance.value = {}

    const change = toChange({ before: beforeInstance, after: afterInstance })
    await requester.requestAllForChangeAndAction({
      action: change.action,
      change,
      changeGroup: { changes: [change], groupID: 'abc' },
      elementSource: buildElementsSourceFromElements([]),
      sharedContext: {},
      errors: {},
    })
    expect(client.put).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/test2/endpoint/5',
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
    const requester = getRequester<{ additionalAction: AdditionalAction }>({
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
      sharedContext: {},
      errors: {},
    })

    expect(client.post).toHaveBeenCalledWith({
      url: '/test/endpoint',
      data: {
        creatableField: 'creatableValue',
      },
    })
  })

  it('should copy back service id', async () => {
    client.post.mockResolvedValue({
      status: 200,
      data: {
        id: 1234,
      },
    })
    const requester = getRequester<{ additionalAction: AdditionalAction }>({
      clients: definitions.clients,
      deployDefQuery: queryWithDefault(definitions.deploy.instances),
      changeResolver: async change => change,
    })
    const change = toChange({ after: instance })
    await requester.requestAllForChangeAndAction({
      action: change.action,
      change,
      changeGroup: { changes: [change], groupID: 'abc' },
      elementSource: buildElementsSourceFromElements([]),
      sharedContext: {},
      errors: {},
    })

    expect(getChangeData(change).value.id).toEqual(1234)
  })
  it('should copy back service id from nested value if sent as nested, and extract additional values if defined', async () => {
    client.post.mockResolvedValue({
      status: 200,
      data: {
        a: {
          id: 1234,
        },
        stop: true,
      },
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
                      nestUnderField: 'a',
                    },
                  },
                  copyFromResponse: {
                    additional: {
                      pick: ['stop'],
                    },
                  },
                },
              ],
            },
          },
        },
      },
    })
    const requester = getRequester<{ additionalAction: AdditionalAction }>({
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
      sharedContext: {},
      errors: {},
    })

    expect(getChangeData(change).value).toEqual({
      creatableField: 'creatableValue',
      ignored: 'ignored',
      id: 1234,
      stop: true,
    })
  })
  it('should copy extra context and nest under elem id', async () => {
    client.post.mockResolvedValue({
      status: 200,
      data: {
        a: {
          id: 1234,
        },
        stop: true,
      },
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
                      nestUnderField: 'a',
                    },
                  },
                  copyFromResponse: {
                    toSharedContext: {
                      pick: ['stop'],
                    },
                  },
                },
              ],
            },
          },
        },
      },
    })
    const requester = getRequester<{ additionalAction: AdditionalAction }>({
      clients: definitions.clients,
      deployDefQuery: queryWithDefault(defs),
      changeResolver: async change => change,
    })
    const change = toChange({ after: instance })
    const sharedContext = {}
    await requester.requestAllForChangeAndAction({
      action: change.action,
      change,
      changeGroup: { changes: [change], groupID: 'abc' },
      elementSource: buildElementsSourceFromElements([]),
      sharedContext,
      errors: {},
    })

    expect(getChangeData(change).value).toEqual({
      creatableField: 'creatableValue',
      ignored: 'ignored',
      id: 1234,
    })
    expect(sharedContext).toEqual({ 'adapter.test.instance.instance': { stop: true } })
  })

  it('should copy extra context at top level when nestUnderElemID=false', async () => {
    client.post.mockResolvedValue({
      status: 200,
      data: {
        a: {
          id: 1234,
        },
        stop: true,
      },
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
                      nestUnderField: 'a',
                    },
                  },
                  copyFromResponse: {
                    toSharedContext: {
                      pick: ['stop'],
                      nestUnderElemID: false,
                    },
                  },
                },
              ],
            },
          },
        },
      },
    })
    const requester = getRequester<{ additionalAction: AdditionalAction }>({
      clients: definitions.clients,
      deployDefQuery: queryWithDefault(defs),
      changeResolver: async change => change,
    })
    const change = toChange({ after: instance })
    const sharedContext = {}
    await requester.requestAllForChangeAndAction({
      action: change.action,
      change,
      changeGroup: { changes: [change], groupID: 'abc' },
      elementSource: buildElementsSourceFromElements([]),
      sharedContext,
      errors: {},
    })

    expect(sharedContext).toEqual({ stop: true })
  })

  it('should omit request body when deploy request config contains omitRequestBody=true', async () => {
    client.delete.mockResolvedValue({
      status: 200,
      data: {},
    })
    if (!definitions.deploy.instances.customizations) {
      definitions.deploy.instances.customizations = {}
    }
    instance.value.id = '1'
    _.set(definitions.clients.options.main.endpoints, 'default.delete.omitBody', true)
    if (definitions.deploy.instances.customizations !== undefined) {
      _.set(
        definitions.deploy.instances.customizations,
        'test.requestsByAction.customizations.remove[0].request.context.instanceId',
        '{id}',
      )
    }
    const requester = getRequester<{ additionalAction: AdditionalAction }>({
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
      sharedContext: {},
      errors: {},
    })
    expect(client.delete).toHaveBeenCalledWith({
      url: '/test/endpoint/1',
      data: undefined,
      queryParams: { instanceId: '1' },
    })
  })

  it('should include request body when deploy request config contains omitRequestBody=false', async () => {
    client.delete.mockResolvedValue({
      status: 200,
      data: {},
    })
    if (!definitions.deploy.instances.customizations) {
      definitions.deploy.instances.customizations = {}
    }
    instance.value.id = '1'
    _.set(definitions.clients.options.main.endpoints, 'default.delete.omitBody', false)
    if (definitions.deploy.instances.customizations !== undefined) {
      _.set(
        definitions.deploy.instances.customizations,
        'test.requestsByAction.customizations.remove[0].request.context.instanceId',
        '{id}',
      )
    }
    const requester = getRequester<{ additionalAction: AdditionalAction }>({
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
      sharedContext: {},
      errors: {},
    })
    expect(client.delete).toHaveBeenCalledWith({
      url: '/test/endpoint/1',
      data: { id: '1', creatableField: 'creatableValue', ignored: 'ignored' },
      queryParams: { instanceId: '1' },
    })
  })

  it('should not throw an error when the client return a valid status code', async () => {
    client.delete.mockRejectedValueOnce(
      new HTTPError('Not Found', {
        data: {},
        status: 404,
      }),
    )

    instance.value.id = '1'
    _.set(definitions.clients.options.main.endpoints, 'default.delete.omitBody', false)
    if (definitions.deploy.instances.customizations !== undefined) {
      _.set(
        definitions.deploy.instances.customizations,
        'test.requestsByAction.customizations.remove[0].request.context.instanceId',
        '{id}',
      )
    }
    const requester = getRequester<{ additionalAction: AdditionalAction }>({
      clients: definitions.clients,
      deployDefQuery: queryWithDefault(definitions.deploy.instances),
      changeResolver: async change => change,
    })
    const change = toChange({ before: instance })
    await expect(
      requester.requestAllForChangeAndAction({
        action: change.action,
        change,
        changeGroup: { changes: [change], groupID: 'abc' },
        elementSource: buildElementsSourceFromElements([]),
        sharedContext: {},
        errors: {},
      }),
    ).resolves.not.toThrow()
  })

  it('should throw an error when the client return a non valid status code', async () => {
    client.delete.mockRejectedValueOnce(
      new HTTPError('Something went wrong', {
        data: {},
        status: 400,
      }),
    )

    instance.value.id = '1'
    _.set(definitions.clients.options.main.endpoints, 'default.delete.omitBody', false)
    if (definitions.deploy.instances.customizations !== undefined) {
      _.set(
        definitions.deploy.instances.customizations,
        'test.requestsByAction.customizations.remove[0].request.context.instanceId',
        '{id}',
      )
    }
    const requester = getRequester<{ additionalAction: AdditionalAction }>({
      clients: definitions.clients,
      deployDefQuery: queryWithDefault(definitions.deploy.instances),
      changeResolver: async change => change,
    })
    const change = toChange({ before: instance })
    await expect(async () => {
      await requester.requestAllForChangeAndAction({
        action: change.action,
        change,
        changeGroup: { changes: [change], groupID: 'abc' },
        elementSource: buildElementsSourceFromElements([]),
        sharedContext: {},
        errors: {},
      })
    }).rejects.toThrow('Something went wrong')
  })

  it('should call the client few times when polling', async () => {
    client.delete
      .mockResolvedValueOnce(
        Promise.resolve({
          data: {},
          status: 502,
        }),
      )
      .mockResolvedValueOnce(
        Promise.resolve({
          data: {},
          status: 502,
        }),
      )
      .mockResolvedValueOnce(
        Promise.resolve({
          data: {},
          status: 200,
        }),
      )

    instance.value.id = '1'
    _.set(definitions.clients.options.main.endpoints, 'default.delete.omitBody', false)
    if (definitions.deploy.instances.customizations !== undefined) {
      _.set(
        definitions.deploy.instances.customizations,
        'test.requestsByAction.customizations.remove[0].request.context.instanceId',
        '{id}',
      )
    }
    const requester = getRequester<{ additionalAction: AdditionalAction }>({
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
      sharedContext: {},
      errors: {},
    })
    expect(client.delete).toHaveBeenCalledTimes(3)
  })

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
    const requester = getRequester<{ additionalAction: AdditionalAction }>({
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
      sharedContext: {},
      errors: {},
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

    const requester = getRequester<{ additionalAction: AdditionalAction }>({
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
      sharedContext: {},
      errors: {},
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

    const requester = getRequester<{ additionalAction: AdditionalAction }>({
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
      sharedContext: {},
      errors: {},
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
