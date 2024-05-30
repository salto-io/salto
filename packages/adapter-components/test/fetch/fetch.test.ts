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
import { MockInterface, mockFunction } from '@salto-io/test-utils'
import { SaltoError, isInstanceElement } from '@salto-io/adapter-api'
import { HTTPReadClientInterface, HTTPWriteClientInterface } from '../../src/client'
import { createMockQuery } from '../../src/fetch/query'
import { noPagination } from '../../src/fetch/request/pagination'
import { getElements } from '../../src/fetch/fetch'

describe('fetch', () => {
  describe('getElements', () => {
    const client: MockInterface<HTTPReadClientInterface & HTTPWriteClientInterface> = {
      get: mockFunction<(HTTPReadClientInterface & HTTPWriteClientInterface)['get']>(),
      put: mockFunction<(HTTPReadClientInterface & HTTPWriteClientInterface)['put']>(),
      patch: mockFunction<(HTTPReadClientInterface & HTTPWriteClientInterface)['patch']>(),
      post: mockFunction<(HTTPReadClientInterface & HTTPWriteClientInterface)['post']>(),
      delete: mockFunction<(HTTPReadClientInterface & HTTPWriteClientInterface)['delete']>(),
      head: mockFunction<(HTTPReadClientInterface & HTTPWriteClientInterface)['head']>(),
      options: mockFunction<(HTTPReadClientInterface & HTTPWriteClientInterface)['options']>(),
      getPageSize: mockFunction<(HTTPReadClientInterface & HTTPWriteClientInterface)['getPageSize']>(),
    }
    beforeEach(() => {
      client.get.mockReset()
      client.post.mockReset()
      client.get.mockImplementation(async ({ url }) => {
        if (url === '/api/v1/groups') {
          return {
            data: {
              groups: [{ id: 123, name: 'group1' }],
            },
            status: 200,
            statusText: 'OK',
          }
        }
        if (url === '/api/v1/fields') {
          return {
            data: {
              fields: [
                { id: 456, name: 'field1' },
                { id: 789, name: 'field2' },
              ],
            },
            status: 200,
            statusText: 'OK',
          }
        }
        if (url === '/api/v1/fields/456/options') {
          return {
            data: {
              options: [{ name: 'opt1' }, { name: 'opt2' }],
            },
            status: 200,
            statusText: 'OK',
          }
        }
        if (url === '/api/v1/fields/789/options') {
          throw new Error('error fetching options')
        }
        if (url === '/api/v1/fields/456/default_option') {
          return {
            data: {
              name: 'opt1',
            },
            status: 200,
            statusText: 'OK',
          }
        }
        if (url === '/api/v1/fields/group1/depending_options') {
          return {
            data: {
              depending_options: [{ name: 'deps1' }],
            },
            status: 200,
            statusText: 'OK',
          }
        }
        if (url === '/api/v1/fields/789/default_option') {
          throw new Error('error fetching default option')
        }
        throw new Error(`unexpected endpoint called: ${url}`)
      })
    })
    // TODO split into multiple tests per component and add cases
    it('should generate elements correctly', async () => {
      const customSaltoError: SaltoError = {
        message: 'error fetching default option',
        severity: 'Warning',
      }
      const res = await getElements<{ customNameMappingOptions: 'custom' }>({
        adapterName: 'myAdapter',
        definitions: {
          clients: {
            default: 'main',
            options: {
              main: {
                httpClient: client,
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
          },
          pagination: {
            none: {
              funcCreator: noPagination,
            },
          },
          fetch: {
            instances: {
              default: {
                element: {
                  topLevel: {
                    elemID: {
                      parts: [{ fieldName: 'name', mapping: 'custom' }],
                    },
                  },
                },
              },
              customizations: {
                depending_option: {
                  requests: [
                    {
                      endpoint: {
                        path: '/api/v1/fields/{parent_id}/depending_options',
                      },
                      transformation: {
                        root: 'depending_options',
                      },
                    },
                  ],
                  resource: {
                    directFetch: true,
                    context: {
                      dependsOn: {
                        parent_id: {
                          parentTypeName: 'group',
                          transformation: {
                            root: 'name',
                          },
                        },
                      },
                    },
                  },
                  element: {
                    topLevel: {
                      isTopLevel: true,
                    },
                  },
                },
                group: {
                  requests: [
                    {
                      endpoint: {
                        path: '/api/v1/groups',
                      },
                      transformation: {
                        root: 'groups',
                      },
                    },
                  ],
                  resource: {
                    directFetch: true,
                  },
                  element: {
                    topLevel: {
                      isTopLevel: true,
                    },
                  },
                },
                field: {
                  requests: [
                    {
                      endpoint: {
                        path: '/api/v1/fields',
                      },
                      transformation: {
                        root: 'fields',
                      },
                    },
                  ],
                  resource: {
                    directFetch: true,
                    recurseInto: {
                      options: {
                        typeName: 'option',
                        context: {
                          args: {
                            parent_id: {
                              root: 'id',
                            },
                          },
                        },
                      },
                      default: {
                        typeName: 'default_option',
                        single: true,
                        context: {
                          args: {
                            parent_id: {
                              root: 'id',
                            },
                          },
                        },
                      },
                    },
                  },
                  element: {
                    topLevel: {
                      isTopLevel: true,
                      elemID: {
                        extendsParent: true,
                      },
                    },
                    fieldCustomizations: {
                      options: {
                        standalone: {
                          typeName: 'option',
                          nestPathUnderParent: true,
                        },
                      },
                    },
                  },
                },
                option: {
                  requests: [
                    {
                      endpoint: {
                        path: '/api/v1/fields/{parent_id}/options',
                      },
                      transformation: {
                        root: 'options',
                      },
                    },
                  ],
                  resource: {
                    directFetch: false,
                    onError: {
                      action: 'configSuggestion',
                      value: {
                        reason: 'error fetching options',
                        type: 'typeToExclude',
                        value: 'some value',
                      },
                    },
                  },
                  element: {
                    topLevel: {
                      isTopLevel: true,
                    },
                  },
                },
                default_option: {
                  requests: [
                    {
                      endpoint: {
                        path: '/api/v1/fields/{parent_id}/default_option',
                      },
                    },
                  ],
                  resource: {
                    directFetch: false,
                    onError: {
                      action: 'customSaltoError',
                      value: customSaltoError,
                    },
                  },
                },
              },
            },
            customNameMappingFunctions: {
              custom: name => `${name}Custom`,
            },
          },
        },
        fetchQuery: createMockQuery(),
      })
      expect(res.errors).toHaveLength(1)
      expect(res.errors).toEqual([customSaltoError])
      expect(res.configChanges).toHaveLength(1)
      expect(res.configChanges?.[0]).toEqual({
        type: 'typeToExclude',
        value: 'some value',
        reason: 'error fetching options',
      })
      expect(res.elements.map(e => e.elemID.getFullName()).sort()).toEqual([
        'myAdapter.depending_option',
        'myAdapter.depending_option.instance.deps1Custom',
        'myAdapter.field',
        'myAdapter.field.instance.field1Custom',
        'myAdapter.field.instance.field2Custom',
        'myAdapter.field__default',
        'myAdapter.group',
        'myAdapter.group.instance.group1Custom',
        'myAdapter.option',
        'myAdapter.option.instance.opt1Custom',
        'myAdapter.option.instance.opt2Custom',
      ])
      expect(
        res.elements
          .filter(isInstanceElement)
          .find(e => e.elemID.getFullName() === 'myAdapter.field.instance.field1Custom')?.value.default,
      ).toEqual({ name: 'opt1' })
      // TODO continue
    })
  })
})
