/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import _ from 'lodash'
import { setupEnvVar } from '@salto-io/test-utils'
import { Values } from '@salto-io/adapter-api'
import { APIDefinitionsOptions, RequiredDefinitions } from '../../../src/definitions/system'
import { DEFINITIONS_OVERRIDES, mergeDefinitionsWithOverrides } from '../../../src/definitions/system/overrides'

describe('overrides', () => {
  const overridesEnvVar = DEFINITIONS_OVERRIDES

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

    describe('when no overrides are provided', () => {
      setupEnvVar(overridesEnvVar, undefined)

      it('should return the original definitions if no overrides are provided', () => {
        const merged = mergeDefinitionsWithOverrides(mockedDefinitions)
        expect(merged).toEqual(mockedDefinitions)
      })
    })

    describe('when the overrides has syntax error', () => {
      setupEnvVar(overridesEnvVar, '{"name": "Alice" "age": 25}')
      it('should return empty object', () => {
        const merged = mergeDefinitionsWithOverrides(mockedDefinitions)
        expect(merged).toEqual(mockedDefinitions)
      })
    })

    describe('when the account name is not provided', () => {
      it('should return the original definitions', () => {
        const merged = mergeDefinitionsWithOverrides(mockedDefinitions)
        expect(merged).toEqual(mockedDefinitions)
      })
    })

    describe('when adding a new type to the fetch definition', () => {
      const jsonString = `{
        "account": {
          "fetch": {
            "instances": {
              "customizations": {
                "group": {
                  "requests": [
                    {
                      "endpoint": {
                        "path": "/groups"
                      },
                      "transformation": {
                        "root": "groups"
                      }
                    }
                  ],
                  "resource": {
                    "directFetch": true
                  },
                  "element": {
                    "topLevel": {
                      "isTopLevel": true
                    }
                  }
                }
              }
            }
          }
        }
      }`
      setupEnvVar(overridesEnvVar, jsonString)
      it('should add a type to the fetch config', () => {
        const merged = mergeDefinitionsWithOverrides(mockedDefinitions, 'account')
        expect(merged.fetch.instances.customizations?.group).toBeDefined()
        expect(merged.fetch.instances.customizations?.team).toBeDefined()
      })
    })
    describe('when providing a new array field in the request fetch definition', () => {
      const jsonString = `{
        "account": {
          "fetch": {
            "instances": {
              "customizations": {
                "team": {
                  "requests": [
                    {
                      "endpoint": {
                        "path": "/teams",
                        "queryArgs": {
                          "wow": "wee"
                        }
                      },
                      "transformation": {
                        "root": "teams"
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      }`
      setupEnvVar(overridesEnvVar, jsonString)

      it('should disable a custom function', () => {
        expect(
          mockedDefinitions.fetch.instances.customizations?.team?.requests?.[0].transformation?.adjust,
        ).toBeDefined()
        const merged = mergeDefinitionsWithOverrides(mockedDefinitions, 'account')
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
    })
    describe('when providing a new reference rule', () => {
      const jsonString = `{
        "account": {
          "references": {
            "rules": [
              {
                "src": {
                  "field": "id",
                  "parentTypes": ["parent2"]
                },
                "serializationStrategy": "id",
                "target": {
                  "type": "myType"
                }
              }
            ]
          }
        }
      }`
      setupEnvVar(overridesEnvVar, jsonString)
      it('should override the reference parent type', () => {
        const merged = mergeDefinitionsWithOverrides(mockedDefinitions, 'account')
        expect(merged.references?.rules[0].src.parentTypes).toEqual(['parent2'])
      })
    })
    describe('when editing an object field in the fetch definition', () => {
      const jsonString = `{
        "account": {
          "fetch": {
            "instances": {
              "default": {
                "element": {
                  "topLevel": {
                    "elemID": {
                      "parts": [
                        {
                          "fieldName": "newName"
                        }
                      ]
                    }
                  }
                }
              }
            }
          }
        }
      }`
      setupEnvVar(overridesEnvVar, jsonString)
      it('should edit the elemId field only', () => {
        const merged = mergeDefinitionsWithOverrides(mockedDefinitions, 'account')
        expect(merged.fetch.instances.default?.element?.topLevel?.elemID).toEqual({ parts: [{ fieldName: 'newName' }] })
        expect(merged.fetch.instances.default?.element?.topLevel?.singleton).toBeTruthy()
      })
    })
    describe('when setting an existing field to null', () => {
      const jsonString = `{
        "account": {
          "fetch": {
            "instances": {
              "customizations": {
                "team": null
              }
            }
          }
        }
      }`
      setupEnvVar(overridesEnvVar, jsonString)
      it('should remove a type from the fetch config', () => {
        const merged = mergeDefinitionsWithOverrides(mockedDefinitions, 'account')
        expect(merged.fetch.instances.customizations?.team).toBeUndefined()
      })
    })
  })
})
