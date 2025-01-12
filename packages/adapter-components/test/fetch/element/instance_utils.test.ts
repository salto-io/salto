/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { BuiltinTypes, ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { queryWithDefault } from '../../../src/definitions'
import { InstanceFetchApiDefinitions } from '../../../src/definitions/system/fetch'
import {
  getInstanceCreationFunctions,
  createInstance,
  omitInstanceValues,
  recursiveNaclCase,
} from '../../../src/fetch/element/instance_utils'

describe('instance utils', () => {
  const type = new ObjectType({ elemID: new ElemID('myAdapter', 'myType') })
  describe('getInstanceCreationFunctions', () => {
    describe('when provided with customizer', () => {
      const customizations: Record<string, InstanceFetchApiDefinitions> = {
        myType: {
          element: {
            topLevel: {
              isTopLevel: true,
              elemID: {
                custom:
                  () =>
                  ({ entry, parent }) =>
                    `${entry.name}~${parent?.value?.name}`,
              },
            },
          },
        },
      }
      it('it should use customizer to create elemID with provided', () => {
        const { toElemName } = getInstanceCreationFunctions({
          defQuery: queryWithDefault<InstanceFetchApiDefinitions, string>({ customizations }),
          type,
        })
        const createdName = toElemName({
          entry: { name: 'test' },
          defaultName: 'default',
          parent: new InstanceElement('parent', type, { name: 'parent' }),
        })
        expect(createdName).toEqual('test~parent')
      })
    })
    describe('instance with standalone fields', () => {
      const customizations: Record<string, InstanceFetchApiDefinitions> = {
        myType: {
          resource: {
            directFetch: true,
          },
          element: {
            topLevel: {
              isTopLevel: true,
              elemID: {
                parts: [{ fieldName: 'str' }],
              },
            },
            fieldCustomizations: {
              standaloneA: { standalone: { typeName: 'anotherType', nestPathUnderParent: true } },
              standaloneB: { standalone: { typeName: 'anotherType', nestPathUnderParent: false } },
            },
          },
        },
      }
      it('should create self folder for instance if it has any standalone fields with nestPathUnderParent', () => {
        const { toElemName, toPath } = getInstanceCreationFunctions({
          defQuery: queryWithDefault<InstanceFetchApiDefinitions, string>({ customizations }),
          type,
        })
        const instance = createInstance({
          entry: { str: 'A', num: 2 },
          type,
          toPath,
          toElemName,
          defaultName: 'test',
        })
        expect(instance?.path).toEqual(['myAdapter', 'Records', 'myType', 'A', 'A'])
      })
      it('should not create self folder for instance if its has no standalone fields', () => {
        const clonedCustomizations = _.cloneDeep(customizations)
        delete clonedCustomizations?.myType?.element?.fieldCustomizations
        const { toElemName, toPath } = getInstanceCreationFunctions({
          defQuery: queryWithDefault<InstanceFetchApiDefinitions, string>({ customizations: clonedCustomizations }),
          type,
        })
        const instance = createInstance({
          entry: { str: 'A', num: 2 },
          type,
          toPath,
          toElemName,
          defaultName: 'test',
        })
        expect(instance?.path).toEqual(['myAdapter', 'Records', 'myType', 'A'])
      })
      it('should not create self folder for instance all its standalone fields disabled nestPathUnderParent', () => {
        const clonedCustomizations = _.cloneDeep(customizations)
        _.set(
          clonedCustomizations,
          'myType.element.fieldCustomizations.standaloneA.standalone.nestPathUnderParent',
          undefined,
        )

        const { toElemName, toPath } = getInstanceCreationFunctions({
          defQuery: queryWithDefault<InstanceFetchApiDefinitions, string>({ customizations: clonedCustomizations }),
          type,
        })
        const instance = createInstance({
          entry: { str: 'A', num: 2 },
          type,
          toPath,
          toElemName,
          defaultName: 'test',
        })
        expect(instance?.path).toEqual(['myAdapter', 'Records', 'myType', 'A'])
      })
    })
  })
  describe('omitInstanceValues', () => {
    const objType = new ObjectType({
      elemID: new ElemID('myAdapter', 'myType'),
      fields: { omitThis: { refType: BuiltinTypes.UNKNOWN } },
    })
    it('should omit nulls, undefined values, and omitted fields from instances', () => {
      const defQuery = queryWithDefault<InstanceFetchApiDefinitions, string>({
        customizations: {
          myType: { element: { topLevel: { isTopLevel: true }, fieldCustomizations: { omitThis: { omit: true } } } },
        },
      })
      expect(
        omitInstanceValues({
          value: { str: 'A', nullVal: null, missing: undefined, something: 'a', omitThis: 'abc' },
          type: objType,
          defQuery,
        }),
      ).toEqual({ str: 'A', something: 'a' })
      expect(
        omitInstanceValues({
          value: {
            str: 'A',
            nullVal: null,
            missing: undefined,
            something: 'a',
            omitThis: { complex: [{ value: true }] },
          },
          type: objType,
          defQuery,
        }),
      ).toEqual({ str: 'A', something: 'a' })
    })
    it('should omit empty arrays and objects by default', () => {
      const defQuery = queryWithDefault<InstanceFetchApiDefinitions, string>({
        customizations: {
          myType: { element: { topLevel: { isTopLevel: true }, fieldCustomizations: { omitThis: { omit: true } } } },
        },
      })
      expect(
        omitInstanceValues({
          value: {
            str: 'A',
            nullVal: null,
            missing: undefined,
            something: 'a',
            omitThis: 'abc',
            emptyArr: [],
            obj: {
              emptyObj: {},
            },
          },
          type: objType,
          defQuery,
        }),
      ).toEqual({ str: 'A', something: 'a' })
    })
    it('should not omit empty arrays when allowEmptyArrays is true', () => {
      const defQuery = queryWithDefault<InstanceFetchApiDefinitions, string>({
        customizations: {
          myType: {
            element: {
              topLevel: { isTopLevel: true, allowEmptyArrays: true },
              fieldCustomizations: { omitThis: { omit: true } },
            },
          },
        },
      })
      expect(
        omitInstanceValues({
          value: {
            str: 'A',
            nullVal: null,
            missing: undefined,
            something: 'a',
            omitThis: 'abc',
            emptyArr: [],
            obj: {
              emptyObj: {},
            },
          },
          type: objType,
          defQuery,
        }),
      ).toEqual({ str: 'A', something: 'a', emptyArr: [] })
    })
  })
  describe('createInstance', () => {
    describe('with allowEmptyArrays', () => {
      it('should not omit empty arrays when allowEmptyArrays is true', () => {
        const createdInstance = createInstance({
          entry: { str: 'A', emptyArr: [] },
          type,
          toElemName: () => 'test',
          toPath: () => ['myAdapter', 'Records', 'myType', 'test'],
          defaultName: 'unnamed',
          allowEmptyArrays: true,
        })
        expect(createdInstance?.value).toEqual({ str: 'A', emptyArr: [] })
      })
      it('should omit empty arrays when allowEmptyArrays is not provided', () => {
        const createdInstance = createInstance({
          entry: { str: 'A', emptyArr: [] },
          type,
          toElemName: () => 'test',
          toPath: () => ['myAdapter', 'Records', 'myType', 'test'],
          defaultName: 'unnamed',
        })
        expect(createdInstance?.value).toEqual({ str: 'A' })
      })
    })
  })
  describe('recursiveNaclCase', () => {
    describe('when invert is false', () => {
      it('should nacl case all keys in object', () => {
        const obj = {
          id: 'abc',
          'some.key': { val: 'a' },
          arr: [{ $foo: 'a', bar: 'b' }],
          innerObj: {
            'i.n.n.e.r': 'a',
          },
        }
        expect(recursiveNaclCase(obj)).toEqual({
          id: 'abc',
          'some_key@v': { val: 'a' },
          arr: [{ '_foo@zc': 'a', bar: 'b' }],
          innerObj: {
            'i_n_n_e_r@v': 'a',
          },
        })
      })
    })
    describe('when invert is true', () => {
      it('should invert nacl case all keys in object', () => {
        const obj = {
          id: 'abc',
          'some_key@v': { val: 'a' },
          arr: [{ '_foo@zc': 'a', bar: 'b' }],
          innerObj: {
            'i_n_n_e_r@v': 'a',
          },
        }
        expect(recursiveNaclCase(obj, true)).toEqual({
          id: 'abc',
          'some.key': { val: 'a' },
          arr: [{ $foo: 'a', bar: 'b' }],
          innerObj: {
            'i.n.n.e.r': 'a',
          },
        })
      })
    })
  })
})
