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
import { DEPLOYMENT_ANNOTATIONS } from '../../../../src/deployment'
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

    expect(() => addDeploymentAnnotations(type, [invalidSwagger], endpoint)).toThrow(
      'Deployment currently only support open api V3'
    )
  })

  it('When there is no endpoint for the type should do nothing should add the annotation to the type', () => {
    addDeploymentAnnotations(type, [mockSwagger], {})
    expect(type.annotations).toEqual({
      [DEPLOYMENT_ANNOTATIONS.CREATABLE]: false,
      [DEPLOYMENT_ANNOTATIONS.UPDATABLE]: false,
      [DEPLOYMENT_ANNOTATIONS.DELETABLE]: false,
    })
  })

  it('When there is no endpoint in the swagger for the type should add the annotation to the type', () => {
    const swaggerClone = _.cloneDeep(mockSwagger)
    swaggerClone.document.paths = {}
    addDeploymentAnnotations(type, [swaggerClone], endpoint)
    expect(type.annotations).toEqual({
      [DEPLOYMENT_ANNOTATIONS.CREATABLE]: false,
      [DEPLOYMENT_ANNOTATIONS.UPDATABLE]: false,
      [DEPLOYMENT_ANNOTATIONS.DELETABLE]: false,
    })
  })

  it('When endpoint is undefined should add the annotation to the type', () => {
    const endpointClone = _.cloneDeep(endpoint)
    endpointClone.add = undefined
    endpointClone.remove = undefined
    addDeploymentAnnotations(type, [mockSwagger], endpointClone)
    expect(type.annotations).toEqual({
      [DEPLOYMENT_ANNOTATIONS.CREATABLE]: false,
      [DEPLOYMENT_ANNOTATIONS.UPDATABLE]: false,
      [DEPLOYMENT_ANNOTATIONS.DELETABLE]: false,
    })
  })

  it('Should add the appropriate annotations', () => {
    addDeploymentAnnotations(type, [mockSwagger], endpoint)
    expect(type.fields.creatableField.annotations).toEqual({
      [DEPLOYMENT_ANNOTATIONS.UPDATABLE]: false,
    })

    expect(type.fields.notCreatableField.annotations).toEqual({
      [DEPLOYMENT_ANNOTATIONS.CREATABLE]: false,
      [DEPLOYMENT_ANNOTATIONS.UPDATABLE]: false,
    })

    expect(type.annotations).toEqual({
      [DEPLOYMENT_ANNOTATIONS.UPDATABLE]: false,
    })
  })
})
