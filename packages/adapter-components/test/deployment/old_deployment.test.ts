/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { mockFunction, MockInterface } from '@salto-io/test-utils'
import { HTTPError, HTTPReadClientInterface, HTTPWriteClientInterface } from '../../src/client/http_client'
import { deployChange } from '../../src/deployment/deployment_deprecated'
import { DeploymentRequestsByAction } from '../../src/config_deprecated/request'

describe('deployChange', () => {
  let type: ObjectType
  let instance: InstanceElement
  let httpClient: MockInterface<HTTPWriteClientInterface & HTTPReadClientInterface>
  let endpoint: DeploymentRequestsByAction

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

    endpoint = {
      add: {
        url: '/test/endpoint',
        method: 'post',
      },
      remove: {
        url: '/test/endpoint/{instanceId}',
        method: 'delete',
        urlParamsToFields: {
          instanceId: 'obj.id',
        },
      },
    }

    httpClient = {
      post: mockFunction<HTTPWriteClientInterface['post']>(),
      put: mockFunction<HTTPWriteClientInterface['put']>(),
      delete: mockFunction<HTTPWriteClientInterface['delete']>(),
      patch: mockFunction<HTTPWriteClientInterface['patch']>(),
      getPageSize: mockFunction<HTTPReadClientInterface['getPageSize']>(),
      get: mockFunction<HTTPReadClientInterface['get']>(),
      head: mockFunction<HTTPReadClientInterface['head']>(),
      options: mockFunction<HTTPReadClientInterface['options']>(),
    }
  })

  it('When no endpoint for deploying the element should throw an error', async () => {
    await expect(() =>
      deployChange({
        change: toChange({ before: instance, after: instance }),
        client: httpClient,
        endpointDetails: endpoint,
      }),
    ).rejects.toThrow('No endpoint of type modify for test')
  })

  it('deleting an instance should send the instance id to the right URL', async () => {
    httpClient.delete.mockResolvedValue({
      status: 200,
      data: {},
    })
    instance.value.obj = { id: 1 }
    await deployChange({
      change: toChange({ before: instance }),
      client: httpClient,
      endpointDetails: endpoint,
    })

    expect(instance.value.obj.id).toBe(1)
    expect(httpClient.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/test/endpoint/1',
      }),
    )
  })

  it('should invert nacl case for all values', async () => {
    httpClient.post.mockResolvedValue({
      status: 200,
      data: {},
    })
    instance.value.custom_headers = {
      'x_bu_code@b': 'test',
    }
    await deployChange({
      change: toChange({ after: instance }),
      client: httpClient,
      endpointDetails: endpoint,
    })
    expect(httpClient.post).toHaveBeenCalledWith({
      url: '/test/endpoint',
      data: expect.objectContaining({
        custom_headers: {
          'x-bu-code': 'test',
        },
      }),
    })
  })

  it('should not send ignored fields', async () => {
    httpClient.post.mockResolvedValue({
      status: 200,
      data: {},
    })
    await deployChange({
      change: toChange({ after: instance }),
      client: httpClient,
      endpointDetails: endpoint,
      fieldsToIgnore: path => path.name === 'ignored',
    })

    expect(httpClient.post).toHaveBeenCalledWith({
      url: '/test/endpoint',
      data: {
        creatableField: 'creatableValue',
      },
    })
  })
  it('should omit request body when deploy request config contains omitRequestBody=true', async () => {
    httpClient.delete.mockResolvedValue({
      status: 200,
      data: {},
    })
    instance.value.id = '1'
    await deployChange({
      change: toChange({ before: instance }),
      client: httpClient,
      endpointDetails: {
        remove: {
          url: '/test/endpoint/{instanceId}',
          method: 'delete',
          urlParamsToFields: {
            instanceId: 'id',
          },
          omitRequestBody: true,
        },
      },
    })
    expect(httpClient.delete).toHaveBeenCalledWith({ url: '/test/endpoint/1', data: undefined, queryParams: undefined })
  })
  it('should include request body when deploy request config contains omitRequestBody=false', async () => {
    httpClient.delete.mockResolvedValue({
      status: 200,
      data: {},
    })
    instance.value.id = '1'
    await deployChange({
      change: toChange({ before: instance }),
      client: httpClient,
      endpointDetails: {
        remove: {
          url: '/test/endpoint/{instanceId}',
          method: 'delete',
          urlParamsToFields: {
            instanceId: 'id',
          },
          omitRequestBody: false,
        },
      },
    })
    expect(httpClient.delete).toHaveBeenCalledWith({
      url: '/test/endpoint/1',
      data: { id: '1', creatableField: 'creatableValue', ignored: 'ignored' },
      queryParams: undefined,
    })
  })
  it('should mark removal change as deployed successfully if request throw with allowedStatusCodesOnRemoval', async () => {
    httpClient.delete.mockRejectedValueOnce(
      new HTTPError('message', {
        status: 404,
        data: {},
      }),
    )
    instance.value.id = '1'
    const result = await deployChange({
      change: toChange({ before: instance }),
      client: httpClient,
      endpointDetails: {
        remove: {
          url: '/test/endpoint/{instanceId}',
          method: 'delete',
          urlParamsToFields: {
            instanceId: 'id',
          },
          omitRequestBody: false,
        },
      },
      allowedStatusCodesOnRemoval: [404],
    })
    expect(result).toEqual(undefined)
  })
  it('should throw if removal change failed with status code no in allowedStatusCodesOnRemoval', async () => {
    httpClient.delete.mockRejectedValueOnce(
      new HTTPError('message', {
        status: 404,
        data: {},
      }),
    )
    instance.value.id = '1'
    await expect(() =>
      deployChange({
        change: toChange({ before: instance }),
        client: httpClient,
        endpointDetails: {
          remove: {
            url: '/test/endpoint/{instanceId}',
            method: 'delete',
            urlParamsToFields: {
              instanceId: 'id',
            },
            omitRequestBody: false,
          },
        },
        allowedStatusCodesOnRemoval: [405],
      }),
    ).rejects.toThrow()
  })
})
