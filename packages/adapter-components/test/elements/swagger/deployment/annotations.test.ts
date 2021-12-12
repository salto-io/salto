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
import { BuiltinTypes, ElemID, ObjectType } from '@salto-io/adapter-api'
import _ from 'lodash'
import { DeploymentRequestsByAction } from '../../../../src/config'
import { addDeploymentAnnotations, LoadedSwagger } from '../../../../src/elements/swagger'

describe('addDeploymentAnnotations', () => {
  let type: ObjectType
  let mockSwagger: LoadedSwagger
  let endpoint: DeploymentRequestsByAction

  beforeEach(() => {
    type = new ObjectType({
      elemID: new ElemID('adapter', 'test'),
      fields: {
        creatableField: { refType: BuiltinTypes.STRING },
        notCreatableField: { refType: BuiltinTypes.STRING },
      },
    })
    endpoint = {
      add: {
        url: '/rest/test/endpoint',
        method: 'post',
      },
      remove: {
        url: '/rest/test/endpoint',
        method: 'delete',
      },
    }

    mockSwagger = {
      document: {
        openapi: '3.0',
        info: {
          title: 'test',
          version: '1.0.0',
        },
        servers: [
          {
            url: 'http://someUrl/rest',
          },
        ],
        paths: {
          '/test/endpoint': {
            post: {
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        creatableField: {
                          type: 'string',
                        },
                        notCreatableField: {
                          type: 'string',
                          readOnly: true,
                        },
                        notExistField: {
                          type: 'string',
                          readOnly: true,
                        },
                      },
                    },
                  },
                },
              },
            },

            delete: {
            },
          },
        },
        definitions: {},
      },
      parser: {},
    } as unknown as LoadedSwagger
  })

  it('When open api version is not v3 should throw an error', () => {
    const invalidSwagger = {
      document: {
        swagger: '2.0',
        info: {
          title: 'test',
          version: '1.0.0',
        },
        paths: {},
        definitions: {},
      },
    } as unknown as LoadedSwagger

    expect(() => addDeploymentAnnotations(type, invalidSwagger, endpoint)).toThrow(
      'Deployment currently only support open api V3'
    )
  })

  it('When there is no endpoint for the type should do nothing', () => {
    const beforeType = type.clone()
    addDeploymentAnnotations(type, mockSwagger, {})
    expect(type.isEqual(beforeType)).toBeTruthy()
  })

  it('When there is no endpoint in the swagger for the type should do nothing', () => {
    const swaggerClone = _.cloneDeep(mockSwagger)
    swaggerClone.document.paths = {}
    const beforeType = type.clone()
    addDeploymentAnnotations(type, swaggerClone, endpoint)
    expect(type.isEqual(beforeType)).toBeTruthy()
  })

  it('When endpoint is undefined should do nothing', () => {
    const endpointClone = _.cloneDeep(endpoint)
    endpointClone.add = undefined
    endpointClone.remove = undefined
    const beforeType = type.clone()
    addDeploymentAnnotations(type, mockSwagger, endpointClone)
    expect(type.isEqual(beforeType)).toBeTruthy()
  })

  it('Should add the appropriate annotations', () => {
    addDeploymentAnnotations(type, mockSwagger, endpoint)
    expect(type.fields.creatableField.annotations).toEqual({
      creatable: true,
    })

    expect(type.fields.notCreatableField.annotations).toEqual({})

    expect(type.annotations).toEqual({
      creatable: true,
      deletable: true,
    })
  })
})
