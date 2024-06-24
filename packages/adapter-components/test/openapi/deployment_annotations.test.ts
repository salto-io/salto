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
import SwaggerParser from '@apidevtools/swagger-parser'
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, Field, ListType, MapType, ObjectType } from '@salto-io/adapter-api'
import { mockFunction } from '@salto-io/test-utils'
import _ from 'lodash'
import { AdapterApiConfig } from '../../src/config_deprecated/shared'
import { addDeploymentAnnotations, LoadedSwagger } from '../../src/openapi'

describe('addDeploymentAnnotations', () => {
  let type: ObjectType
  let innerListType: ObjectType
  let innerType: ObjectType
  let mapType: ObjectType
  let mockSwagger: LoadedSwagger
  let apiDefinitions: AdapterApiConfig

  beforeEach(() => {
    innerListType = new ObjectType({
      elemID: new ElemID('adapter', 'innerListType'),
      fields: {
        innerField: { refType: BuiltinTypes.STRING },
      },
    })

    innerType = new ObjectType({
      elemID: new ElemID('adapter', 'innerType'),
      fields: {
        innerField: { refType: BuiltinTypes.STRING },
        circular: { refType: innerListType },
      },
    })

    mapType = new ObjectType({
      elemID: new ElemID('adapter', 'mapType'),
      fields: {
        innerField: { refType: BuiltinTypes.STRING },
      },
    })

    innerListType.fields.circular = new Field(innerListType, 'circular', innerType)

    type = new ObjectType({
      elemID: new ElemID('adapter', 'test'),
      fields: {
        creatableField: { refType: BuiltinTypes.STRING },
        notCreatableField: { refType: BuiltinTypes.STRING },
        innerList: { refType: new ListType(innerListType) },
        inner: { refType: innerType },
        additionalProperties: { refType: new MapType(mapType) },
      },
    })

    apiDefinitions = {
      typeDefaults: {
        transformation: {
          idFields: ['.'],
        },
      },
      types: {
        test: {
          deployRequests: {
            add: {
              url: '/rest/test/endpoint',
              method: 'post',
            },
            remove: {
              url: '/rest/test/endpoint?id={id}',
              method: 'delete',
            },
          },
        },
      },
      supportedTypes: {},
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
                        innerList: {
                          type: 'array',
                          items: {
                            $ref: '#/components/schemas/innerListType',
                          },
                        },
                        inner: {
                          $ref: '#/components/schemas/innerType',
                        },
                      },
                      additionalProperties: {
                        type: 'object',
                        properties: {
                          innerField: {
                            type: 'string',
                          },
                        },
                      },
                    },
                  },
                },
              },
            },

            delete: {},
          },
        },
        definitions: {},
      },
      parser: {
        $refs: {
          get: mockFunction<SwaggerParser.$Refs['get']>().mockImplementation(ref => {
            if (ref === '#/components/schemas/innerListType') {
              return {
                type: 'object',
                properties: {
                  innerField: {
                    type: 'string',
                  },
                  circular: {
                    $ref: '#/components/schemas/innerType',
                  },
                },
              }
            }

            if (ref === '#/components/schemas/innerType') {
              return {
                type: 'object',
                properties: {
                  innerField: {
                    type: 'string',
                  },
                  circular: {
                    $ref: '#/components/schemas/innerListType',
                  },
                },
              }
            }
            return undefined
          }),
        },
      },
    } as unknown as LoadedSwagger
  })

  it('When open api version is not v3 should throw an error', async () => {
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

    await expect(addDeploymentAnnotations([type], [invalidSwagger], apiDefinitions)).rejects.toThrow(
      'Deployment currently only supports open api V3',
    )
  })

  it('When there is no endpoint for the type should do nothing should add the annotation to the type', async () => {
    apiDefinitions.types.test = {}
    await addDeploymentAnnotations([type], [mockSwagger], apiDefinitions)
    expect(type.annotations).toEqual({
      [CORE_ANNOTATIONS.CREATABLE]: false,
      [CORE_ANNOTATIONS.UPDATABLE]: false,
      [CORE_ANNOTATIONS.DELETABLE]: false,
    })
  })

  it('When there is no endpoint in the swagger for the type should add the annotation to the type', async () => {
    const swaggerClone = _.cloneDeep(mockSwagger)
    swaggerClone.document.paths = {}
    await addDeploymentAnnotations([type], [swaggerClone], apiDefinitions)
    expect(type.annotations).toEqual({
      [CORE_ANNOTATIONS.CREATABLE]: false,
      [CORE_ANNOTATIONS.UPDATABLE]: false,
      [CORE_ANNOTATIONS.DELETABLE]: false,
    })
  })

  it('When endpoint is undefined should add the annotation to the type', async () => {
    const { deployRequests } = apiDefinitions.types.test
    ;(deployRequests as { add: unknown }).add = undefined
    ;(deployRequests as { remove: unknown }).remove = undefined

    await addDeploymentAnnotations([type], [mockSwagger], apiDefinitions)
    expect(type.annotations).toEqual({
      [CORE_ANNOTATIONS.CREATABLE]: false,
      [CORE_ANNOTATIONS.UPDATABLE]: false,
      [CORE_ANNOTATIONS.DELETABLE]: false,
    })
  })

  it('Should add the appropriate annotations', async () => {
    await addDeploymentAnnotations([type, innerListType, innerType, mapType], [mockSwagger], apiDefinitions)
    expect(type.fields.creatableField.annotations).toEqual({
      [CORE_ANNOTATIONS.UPDATABLE]: false,
    })

    expect(type.fields.inner.annotations).toEqual({
      [CORE_ANNOTATIONS.UPDATABLE]: false,
    })

    expect(type.fields.innerList.annotations).toEqual({
      [CORE_ANNOTATIONS.UPDATABLE]: false,
    })

    expect(type.fields.additionalProperties.annotations).toEqual({
      [CORE_ANNOTATIONS.UPDATABLE]: false,
    })

    expect(type.fields.notCreatableField.annotations).toEqual({
      [CORE_ANNOTATIONS.CREATABLE]: false,
      [CORE_ANNOTATIONS.UPDATABLE]: false,
    })

    expect(type.annotations).toEqual({
      [CORE_ANNOTATIONS.UPDATABLE]: false,
    })

    expect(innerListType.fields.innerField.annotations).toEqual({
      [CORE_ANNOTATIONS.UPDATABLE]: false,
    })

    expect(innerListType.fields.circular.annotations).toEqual({
      [CORE_ANNOTATIONS.UPDATABLE]: false,
    })

    expect(innerType.fields.circular.annotations).toEqual({
      [CORE_ANNOTATIONS.UPDATABLE]: false,
    })

    expect(mapType.fields.innerField.annotations).toEqual({
      [CORE_ANNOTATIONS.UPDATABLE]: false,
    })
  })
})
