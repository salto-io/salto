/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { mockFunction, MockInterface } from '@salto-io/test-utils'
import { HTTPWriteClientInterface } from '../../src/client/http_client'
import { deployChange } from '../../src/deployment/deployment'
import { DeploymentRequestsByAction } from '../../src/config/request'

describe('deployChange', () => {
  let type: ObjectType
  let instance: InstanceElement
  let httpClient: MockInterface<HTTPWriteClientInterface>
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

    instance = new InstanceElement(
      'instance',
      type,
      {
        creatableField: new ReferenceExpression(new ElemID('adapter', 'type', 'instance', 'instance', 'val'), 'creatableValue'),
      }
    )

    endpoint = {
      add: {
        url: '/test/endpoint',
        method: 'post',
      },
      remove: {
        url: '/test/endpoint/{instanceId}',
        method: 'delete',
        urlParamsToFields: {
          instanceId: 'id',
        },
      },
    }

    httpClient = {
      post: mockFunction<HTTPWriteClientInterface['post']>(),
      put: mockFunction<HTTPWriteClientInterface['put']>(),
      delete: mockFunction<HTTPWriteClientInterface['delete']>(),
      patch: mockFunction<HTTPWriteClientInterface['patch']>(),
    }
  })

  it('When no endpoint for deploying the element should throw an error', async () => {
    await expect(() => deployChange(
      toChange({ before: instance, after: instance }),
      httpClient,
      endpoint
    )).rejects.toThrow(
      'No endpoint of type modify for test'
    )
  })

  it('deleting an instance should send the instance id to the right URL', async () => {
    httpClient.delete.mockResolvedValue({
      status: 200,
      data: {},
    })
    instance.value.id = 1
    await deployChange(
      toChange({ before: instance }),
      httpClient,
      endpoint
    )

    expect(instance.value.id).toBe(1)
    expect(httpClient.delete).toHaveBeenCalledWith(expect.objectContaining({
      url: '/test/endpoint/1',
    }))
  })
})
