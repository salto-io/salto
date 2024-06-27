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
import { setupEnvVar } from '@salto-io/test-utils'
import { Values } from '@salto-io/adapter-api'
import {
  APIDefinitionsOptions,
  DEFINITIONS_OVERRIDES,
  RequiredDefinitions,
  getParsedDefinitionsOverrides,
  mergeDefinitionsWithOverrides,
} from '../../../src/definitions/system'

describe('overrides', () => {
  describe('getParsedDefinitionsOverrides', () => {
    const flagName = DEFINITIONS_OVERRIDES

    describe('when flag is not set', () => {
      setupEnvVar(flagName, undefined)
      it('should return empty object', () => {
        expect(getParsedDefinitionsOverrides()).toEqual({})
      })
    })

    describe('when the flag has syntax error', () => {
      setupEnvVar(flagName, '{"name": "Alice" "age": 25}')
      it('should return empty object', () => {
        expect(getParsedDefinitionsOverrides()).toEqual({})
      })
    })

    describe('when flag is set correctly', () => {
      const jsonString = `{
        "name": "Uri",
        "address": {
            "street": "123 Main St",
            "city": "Wonderland"
        },
        "courses": [
            {
                "title": "Introduction to Magic",
                "completed": true
            },
            {
                "title": "Advanced Magic",
                "completed": false
            }
        ]
      }`
      setupEnvVar(flagName, jsonString)
      it('should return an object', () => {
        const parsed = getParsedDefinitionsOverrides()
        expect(parsed.name).toEqual('Uri')
        expect(parsed.address.street).toEqual('123 Main St')
        expect(parsed.courses[0].title).toEqual('Introduction to Magic')
      })
    })
  })

  describe('mergeDefinitionsWithOverrides', () => {
    const mockedDefinitions = {
      fetch: {
        instances: {
          default: {
            resource: {
              serviceIDFields: ['id'],
            },
            element: {
              topLevel: {
                elemID: { parts: [{ fieldName: 'name' }] },
                singleton: true,
              },
            },
          },
          customizations: {
            team: {
              requests: [
                {
                  endpoint: {
                    path: '/teams',
                    queryArgs: {
                      wow: 'wee',
                    },
                  },
                  transformation: {
                    root: 'teams',
                    adjust: (item: { value: Values }) => {
                      const { value } = item
                      return {
                        value: {
                          ...value,
                          fields: _.keyBy(value.fields, 'fieldName'),
                        },
                      }
                    },
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
          },
        },
      },
      references: {
        rules: [
          {
            src: { field: 'id', parentTypes: ['parent1'] },
            serializationStrategy: 'id',
            target: { type: 'myType' },
          },
        ],
      },
    } as unknown as RequiredDefinitions<APIDefinitionsOptions>

    it('should return the original definitions if no overrides are provided', () => {
      const merged = mergeDefinitionsWithOverrides(mockedDefinitions, {})
      expect(merged).toEqual(mockedDefinitions)
    })
    it('should add a type to the fetch config', () => {
      const overrides: Values = {
        fetch: {
          instances: {
            customizations: {
              group: {
                requests: [
                  {
                    endpoint: {
                      path: '/groups',
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
            },
          },
        },
      }
      const merged = mergeDefinitionsWithOverrides(mockedDefinitions, overrides)
      expect(merged.fetch.instances.customizations?.group).toBeDefined()
    })
    it('should disable a custom function', () => {
      expect(mockedDefinitions.fetch.instances.customizations?.team?.requests?.[0].transformation?.adjust).toBeDefined()
      const overrides = {
        fetch: {
          instances: {
            customizations: {
              team: {
                requests: [
                  {
                    endpoint: {
                      path: '/teams',
                      queryArgs: {
                        wow: 'wee',
                      },
                    },
                    transformation: {
                      root: 'teams',
                    },
                  },
                ],
              },
            },
          },
        },
      }
      const merged = mergeDefinitionsWithOverrides(mockedDefinitions, overrides)
      expect(merged.fetch.instances.customizations?.team?.element).toEqual(
        mockedDefinitions.fetch.instances.customizations?.team?.element,
      )
      expect(merged.fetch.instances.customizations?.team?.resource).toEqual(
        mockedDefinitions.fetch.instances.customizations?.team?.resource,
      )
      expect(merged.fetch.instances.customizations?.team?.requests?.[0].transformation?.root).toEqual(
        mockedDefinitions.fetch.instances.customizations?.team?.requests?.[0].transformation?.root,
      )
      expect(merged.fetch.instances.customizations?.team?.requests?.[0].transformation?.adjust).toBeUndefined()
    })
    it('should override the reference parent type', () => {
      const overrides = {
        references: {
          rules: [
            {
              src: { field: 'id', parentTypes: ['parent2'] },
              serializationStrategy: 'id',
              target: { type: 'myType' },
            },
          ],
        },
      }
      const merged = mergeDefinitionsWithOverrides(mockedDefinitions, overrides)
      expect(merged.references?.rules[0].src.parentTypes).toEqual(['parent2'])
    })
    it('should edit the elemId field only', () => {
      const overrides = {
        fetch: {
          instances: {
            default: {
              element: {
                topLevel: {
                  elemID: { parts: [{ fieldName: 'newName' }] },
                },
              },
            },
          },
        },
      }
      const merged = mergeDefinitionsWithOverrides(mockedDefinitions, overrides)
      expect(merged.fetch.instances.default?.element?.topLevel?.elemID).toEqual(
        overrides.fetch.instances.default.element.topLevel.elemID,
      )
      expect(merged.fetch.instances.default?.element?.topLevel?.singleton).toBeTruthy()
    })
  })
})
