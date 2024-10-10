/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  ElemID,
  InstanceElement,
  ObjectType,
  SaltoError,
  isEqualElements,
  isInstanceElement,
  isObjectType,
  CORE_ANNOTATIONS,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { getElementGenerator } from '../../../src/fetch/element/element'
import { AbortFetchOnFailure } from '../../../src/fetch/errors'
import { ConfigChangeSuggestion, queryWithDefault } from '../../../src/definitions'
import { InstanceFetchApiDefinitions } from '../../../src/definitions/system/fetch'

describe('element', () => {
  const typeID = new ElemID('myAdapter', 'myType')
  describe('getElementGenerator', () => {
    it('should create empty type with no instances when no entries or defs are provided', () => {
      const generator = getElementGenerator({
        adapterName: 'myAdapter',
        defQuery: queryWithDefault<InstanceFetchApiDefinitions, string>({
          customizations: { myType: { element: { topLevel: { isTopLevel: true } } } },
        }),
        customNameMappingFunctions: {},
      })
      generator.pushEntries({
        entries: [],
        typeName: 'myType',
      })
      const res = generator.generate()
      expect(res.errors).toEqual([])
      expect(res.elements).toHaveLength(1)
      expect(res.elements[0].isEqual(new ObjectType({ elemID: typeID, fields: {} }))).toEqual(true)
    })
    it('should create type with serviceId field as string and hidden fields as unknown when no entries provided', () => {
      const generator = getElementGenerator({
        adapterName: 'myAdapter',
        defQuery: queryWithDefault<InstanceFetchApiDefinitions, string>({
          customizations: {
            myType: {
              element: {
                topLevel: { isTopLevel: true },
                fieldCustomizations: { fieldToHide: { hide: true }, serviceId: { hide: true } },
              },
              resource: { serviceIDFields: ['serviceId'], directFetch: true },
            },
          },
        }),
        customNameMappingFunctions: {},
      })
      generator.pushEntries({
        entries: [],
        typeName: 'myType',
      })
      const res = generator.generate()
      expect(res.errors).toEqual([])
      expect(res.elements).toHaveLength(1)
      expect(res.elements[0]).toBeInstanceOf(ObjectType)
      const objType = res.elements[0] as ObjectType
      expect(_.mapValues(objType?.fields, f => f.getTypeSync().elemID.name)).toEqual({
        fieldToHide: 'unknown',
        serviceId: 'serviceid',
      })
      expect(objType.fields.fieldToHide?.annotations).toEqual({ [CORE_ANNOTATIONS.HIDDEN_VALUE]: true })
    })
    it('should not throw when type is not marked as top-level', () => {
      const generator = getElementGenerator({
        adapterName: 'myAdapter',
        defQuery: queryWithDefault<InstanceFetchApiDefinitions, string>({
          customizations: { myType: { element: {} } },
        }),
        customNameMappingFunctions: {},
      })
      generator.pushEntries({
        entries: [],
        typeName: 'myType',
      })
      const res = generator.generate()
      expect(res.errors).toEqual([])
      expect(res.elements).toEqual([])
    })
    it('should create instances and matching type when entries are provided and no defs', () => {
      const entries = [
        { str: 'A', num: 2, arr: [{ st: 'X', unknown: true }] },
        { str: 'CCC', arr: [{ unknown: 'text' }] },
      ]
      const generator = getElementGenerator({
        adapterName: 'myAdapter',
        defQuery: queryWithDefault<InstanceFetchApiDefinitions, string>({
          customizations: {
            myType: {
              element: {
                topLevel: { isTopLevel: true },
              },
            },
          },
        }),
        customNameMappingFunctions: {},
      })
      generator.pushEntries({
        entries,
        typeName: 'myType',
      })
      const res = generator.generate()
      expect(res.errors).toEqual([])
      expect(res.elements).toHaveLength(4)
      expect(res.elements.map(e => e.elemID.getFullName()).sort()).toEqual([
        'myAdapter.myType',
        'myAdapter.myType.instance.unnamed_0',
        'myAdapter.myType.instance.unnamed_1',
        'myAdapter.myType__arr',
      ])
      const objType = res.elements
        .filter(isObjectType)
        .find(e => e.elemID.getFullName() === 'myAdapter.myType') as ObjectType
      const subType = res.elements.filter(isObjectType).find(e => e.elemID.getFullName() === 'myAdapter.myType__arr')
      expect(_.mapValues(objType?.fields, f => f.getTypeSync().elemID.name)).toEqual({
        str: 'string',
        num: 'number',
        arr: 'List<myAdapter.myType__arr>',
      })
      expect(_.mapValues(subType?.fields, f => f.getTypeSync().elemID.name)).toEqual({
        st: 'string',
        unknown: 'unknown',
      })
      expect(
        isEqualElements(
          res.elements.filter(isInstanceElement).find(e => e.elemID.name === 'unnamed_0'),
          new InstanceElement('unnamed_0', objType, entries[0], []),
        ),
      ).toBeTruthy()
      expect(
        isEqualElements(
          res.elements.filter(isInstanceElement).find(e => e.elemID.name === 'unnamed_1'),
          new InstanceElement('unnamed_1', objType, entries[1], []),
        ),
      ).toBeTruthy()
    })
    it('should create instances and matching type based on defined customizations', () => {
      const entries = [
        { str: 'A', otherField: 'B', num: 2, arr: [{ st: 'X', unknown: true }] },
        { str: 'CCC', otherField: 'DDD', arr: [{ unknown: 'text' }] },
      ]
      const generator = getElementGenerator({
        adapterName: 'myAdapter',
        defQuery: queryWithDefault<
          InstanceFetchApiDefinitions<{ customNameMappingOptions: 'firstCustom' | 'secondCustom' }>,
          string
        >({
          customizations: {
            myType: {
              resource: {
                directFetch: true,
                serviceIDFields: ['str'],
              },
              element: {
                topLevel: {
                  isTopLevel: true,
                  elemID: {
                    parts: [
                      { fieldName: 'str', mapping: 'firstCustom' },
                      { fieldName: 'otherField', mapping: 'secondCustom' },
                    ],
                  },
                },
              },
            },
            myType__arr: {
              element: {
                fieldCustomizations: {
                  unknown: {
                    fieldType: 'boolean',
                  },
                },
              },
            },
          },
        }),
        customNameMappingFunctions: {
          firstCustom: name => `${name}CustomTest`,
          secondCustom: name => `Second${name}`,
        },
      })
      generator.pushEntries({
        entries,
        typeName: 'myType',
      })
      const res = generator.generate()
      expect(res.errors).toEqual([])
      expect(res.elements).toHaveLength(4)
      expect(res.elements.map(e => e.elemID.getFullName()).sort()).toEqual([
        'myAdapter.myType',
        'myAdapter.myType.instance.ACustomTest_SecondB',
        'myAdapter.myType.instance.CCCCustomTest_SecondDDD',
        'myAdapter.myType__arr',
      ])
      const objType = res.elements
        .filter(isObjectType)
        .find(e => e.elemID.getFullName() === 'myAdapter.myType') as ObjectType
      const subType = res.elements.filter(isObjectType).find(e => e.elemID.getFullName() === 'myAdapter.myType__arr')
      expect(_.mapValues(objType?.fields, f => f.getTypeSync().elemID.name)).toEqual({
        str: 'serviceid',
        num: 'number',
        otherField: 'string',
        arr: 'List<myAdapter.myType__arr>',
      })
      expect(_.mapValues(subType?.fields, f => f.getTypeSync().elemID.name)).toEqual({
        st: 'string',
        unknown: 'boolean',
      })
      expect(
        isEqualElements(
          res.elements.filter(isInstanceElement).find(e => e.elemID.name === 'ACustomTest_SecondB'),
          new InstanceElement('ACustomTest_SecondB', objType, entries[0], []),
        ),
      ).toBeTruthy()
      expect(
        isEqualElements(
          res.elements.filter(isInstanceElement).find(e => e.elemID.name === 'CCCCustomTest_SecondDDD'),
          new InstanceElement('CCCCustomTest_SecondDDD', objType, entries[1], []),
        ),
      ).toBeTruthy()
    })

    describe('handleError', () => {
      const fetchError = new Error('failed to fetch')
      const logging = logger('adapter-components/src/fetch/element/element')
      const logErrorSpy = jest.spyOn(logging, 'error')
      const logWarnSpy = jest.spyOn(logging, 'warn')

      beforeEach(() => {
        jest.clearAllMocks()
      })

      describe('when onError defined with failEntireFetch', () => {
        it('should throw an error when failEntireFetch is true', () => {
          const generator = getElementGenerator({
            adapterName: 'myAdapter',
            defQuery: queryWithDefault<InstanceFetchApiDefinitions, string>({
              customizations: {
                myType: {
                  element: { topLevel: { isTopLevel: true } },
                  resource: {
                    directFetch: true,
                    onError: {
                      action: 'failEntireFetch',
                      value: true,
                    },
                  },
                },
              },
            }),
            customNameMappingFunctions: {},
          })
          expect(() => generator.handleError({ typeName: 'myType', error: fetchError })).toThrow(AbortFetchOnFailure)
        })
      })

      describe('when onError defined with customSaltoError', () => {
        const customSaltoError: SaltoError = {
          message: 'custom error',
          detailedMessage: 'custom error',
          severity: 'Warning',
          type: 'unresolvedReferences',
        }

        it('should generate custom error that returned from onError', () => {
          const generator = getElementGenerator({
            adapterName: 'myAdapter',
            defQuery: queryWithDefault<InstanceFetchApiDefinitions, string>({
              customizations: {
                myType: {
                  element: { topLevel: { isTopLevel: true } },
                  resource: {
                    directFetch: true,
                    onError: {
                      action: 'customSaltoError',
                      value: customSaltoError,
                    },
                  },
                },
              },
            }),
          })
          generator.handleError({ typeName: 'myType', error: fetchError })
          const res = generator.generate()
          expect(res.errors).toHaveLength(1)
          expect(res.errors?.[0]).toEqual(customSaltoError)
        })

        it('should log "failed to fetch type" warning', () => {
          const generator = getElementGenerator({
            adapterName: 'myAdapter',
            defQuery: queryWithDefault<InstanceFetchApiDefinitions, string>({
              customizations: {
                myType: {
                  element: { topLevel: { isTopLevel: true } },
                  resource: {
                    directFetch: true,
                    onError: {
                      action: 'customSaltoError',
                      value: customSaltoError,
                    },
                  },
                },
              },
            }),
          })
          generator.handleError({ typeName: 'myType', error: fetchError })
          generator.generate()
          expect(logWarnSpy).toHaveBeenCalledWith(
            'failed to fetch type %s:%s, generating custom Salto error',
            expect.any(String),
            expect.any(String),
          )
          expect(logErrorSpy).not.toHaveBeenCalled()
        })
      })

      describe('when onError defined with configSuggestion', () => {
        const configSuggestion: ConfigChangeSuggestion = {
          reason: 'test',
          type: 'typeToExclude',
          value: 'valueToExclude',
        }

        it('should generate config change suggestion that returned from onError', () => {
          const generator = getElementGenerator({
            adapterName: 'myAdapter',
            defQuery: queryWithDefault<InstanceFetchApiDefinitions, string>({
              customizations: {
                myType: {
                  element: { topLevel: { isTopLevel: true } },
                  resource: {
                    directFetch: true,
                    onError: {
                      action: 'configSuggestion',
                      value: configSuggestion,
                    },
                  },
                },
              },
            }),
          })
          generator.handleError({ typeName: 'myType', error: fetchError })
          const res = generator.generate()
          expect(res.configChanges).toHaveLength(1)
          expect(res.configChanges?.[0]).toEqual(configSuggestion)
        })

        it('should log "failed to fetch type" warning', () => {
          const generator = getElementGenerator({
            adapterName: 'myAdapter',
            defQuery: queryWithDefault<InstanceFetchApiDefinitions, string>({
              customizations: {
                myType: {
                  element: { topLevel: { isTopLevel: true } },
                  resource: {
                    directFetch: true,
                    onError: {
                      action: 'configSuggestion',
                      value: configSuggestion,
                    },
                  },
                },
              },
            }),
          })
          generator.handleError({ typeName: 'myType', error: fetchError })
          generator.generate()
          expect(logWarnSpy).toHaveBeenCalledWith(
            'failed to fetch type %s:%s, generating config suggestions',
            expect.any(String),
            expect.any(String),
          )
          expect(logErrorSpy).not.toHaveBeenCalled()
        })
      })

      describe('when onError defined with ignoreError', () => {
        const generator = getElementGenerator({
          adapterName: 'myAdapter',
          defQuery: queryWithDefault<InstanceFetchApiDefinitions, string>({
            customizations: {
              myType: {
                element: { topLevel: { isTopLevel: true } },
                resource: {
                  directFetch: true,
                  onError: {
                    action: 'ignoreError',
                  },
                },
              },
            },
          }),
        })
        it('should not return any error', () => {
          generator.handleError({ typeName: 'myType', error: fetchError })
          const res = generator.generate()
          expect(res.elements).toHaveLength(0)
          expect(res.errors).toHaveLength(0)
          expect(res.configChanges).toHaveLength(0)
        })

        it('should not log "failed to fetch type" error', () => {
          generator.handleError({ typeName: 'myType', error: fetchError })
          generator.generate()
          expect(logErrorSpy).not.toHaveBeenCalled()
        })
      })

      describe('when using a custom error handler', () => {
        it('should call custom error handler if defined', () => {
          const customErrorHandler = jest.fn().mockReturnValue({ action: 'failEntireFetch', value: true, ignore: true })
          const generator = getElementGenerator({
            adapterName: 'myAdapter',
            defQuery: queryWithDefault<InstanceFetchApiDefinitions, string>({
              customizations: {
                myType: {
                  element: { topLevel: { isTopLevel: true } },
                  resource: {
                    directFetch: true,
                  },
                },
              },
              default: {
                resource: {
                  onError: {
                    custom: () => customErrorHandler,
                  },
                },
              },
            }),
          })
          expect(() => generator.handleError({ typeName: 'myType', error: fetchError })).toThrow(AbortFetchOnFailure)
          expect(customErrorHandler).toHaveBeenCalledWith({ error: fetchError, typeName: 'myType' })
        })
      })

      describe('when onError is not provided', () => {
        const generator = getElementGenerator({
          adapterName: 'myAdapter',
          defQuery: queryWithDefault<InstanceFetchApiDefinitions, string>({
            customizations: {
              myType: {
                element: { topLevel: { isTopLevel: true } },
                resource: {
                  directFetch: true,
                },
              },
            },
          }),
        })

        it('should not return any error', () => {
          generator.handleError({ typeName: 'myType', error: fetchError })
          const res = generator.generate()
          expect(res.elements).toHaveLength(0)
          expect(res.errors).toHaveLength(0)
          expect(res.configChanges).toHaveLength(0)
        })

        it('should log "unexpectedly failed to fetch type" error by default', () => {
          generator.handleError({ typeName: 'myType', error: fetchError })
          generator.generate()
          expect(logErrorSpy).toHaveBeenCalledWith(
            'unexpectedly failed to fetch type %s:%s: %s',
            expect.any(String),
            expect.any(String),
            fetchError.message,
            { adapterName: 'myAdapter', typeName: 'myType' },
          )
        })
      })
    })
  })
})
