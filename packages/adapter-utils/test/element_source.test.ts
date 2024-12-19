/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  BuiltinTypes,
  Element,
  ElemID,
  GLOBAL_ADAPTER,
  InstanceElement,
  ObjectType,
  PlaceholderObjectType,
  ReadOnlyElementsSource,
  TypeReference,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import {
  buildElementsSourceFromElements,
  buildLazyShallowTypeResolverElementsSource,
  createElemIDReplacedElementsSource,
  filterElementsSource,
} from '../src/element_source'
import * as utilsModule from '../src/utils'

const { toArrayAsync } = collections.asynciterable

describe('elementSource', () => {
  let instanceElement: InstanceElement
  let objectType: ObjectType
  let elements: Element[]
  let elementsSource: ReadOnlyElementsSource
  describe('buildElementsSourceFromElements', () => {
    describe('when built from elements', () => {
      beforeEach(() => {
        objectType = new ObjectType({
          elemID: new ElemID('adapter', 'type3'),
          fields: { key: { refType: BuiltinTypes.STRING } },
        })
        instanceElement = new InstanceElement('instance', objectType, {
          key: 'value',
        })
        elements = [
          new ObjectType({ elemID: new ElemID('adapter', 'type1') }),
          new ObjectType({ elemID: new ElemID('adapter', 'type2') }),
          objectType,
          instanceElement,
        ]
        elementsSource = buildElementsSourceFromElements(elements)
      })

      describe('getAll', () => {
        it('should return all the elements', async () => {
          const receivedElements = await toArrayAsync(await elementsSource.getAll())
          expect(receivedElements).toEqual(elements)
        })

        it('should return the element with PlaceholderObjectType if the type is not in the source', async () => {
          const instance = new InstanceElement('instance', new TypeReference(new ElemID('adapter', 'unknownType')))
          // I pass an inner elements source here because we try to resolve only elements that
          // are coming from the fallback source, so passing it in the first param as elements will test nothing
          const source = buildElementsSourceFromElements([], [buildElementsSourceFromElements([instance])])
          const receivedInstance = (await toArrayAsync(await source.getAll()))[0] as InstanceElement
          expect(receivedInstance.refType.type).toMatchObject(
            new PlaceholderObjectType({
              elemID: receivedInstance.refType.elemID,
            }),
          )
        })
      })

      describe('get', () => {
        it('should return element if exists', async () => {
          expect(await elementsSource.get(new ElemID('adapter', 'type1'))).toBe(elements[0])
        })

        it('should return undefined if not exists', async () => {
          expect(await elementsSource.get(new ElemID('adapter', 'type4'))).toBeUndefined()
        })
      })

      it('should return a non top level element if exists', async () => {
        const nestedElemId = instanceElement.elemID.createNestedID('key')
        expect(await elementsSource.get(nestedElemId)).toBe('value')
      })

      it('should return nested field when the field is in the source but the parent is not', async () => {
        const field = objectType.fields.key
        const source = buildElementsSourceFromElements([field])
        expect(await source.get(field.elemID)).toEqual(field)
      })

      describe('list', () => {
        it('should return all the elements ids', async () => {
          const receivedElementsIds = await collections.asynciterable.toArrayAsync(await elementsSource.list())
          expect(receivedElementsIds).toEqual(elements.map(e => e.elemID))
        })
      })

      describe('has', () => {
        it('should return true if element id exists', async () => {
          expect(await elementsSource.has(new ElemID('adapter', 'type1'))).toBeTruthy()
        })

        it('should return false if element id does not exist', async () => {
          expect(await elementsSource.has(new ElemID('adapter', 'type4'))).toBeFalsy()
        })

        it('should return true for a non top level element if exists', async () => {
          const nestedElemId = instanceElement.elemID.createNestedID('key')
          expect(await elementsSource.has(nestedElemId)).toBeTruthy()
        })

        it('should return true for nested field when the field is in the source but the parent is not', async () => {
          const field = objectType.fields.key
          const source = buildElementsSourceFromElements([field])
          expect(await source.has(field.elemID)).toBeTruthy()
        })
      })
    })

    describe('with fallback element source', () => {
      let fallbackSource1: ReadOnlyElementsSource
      let fallbackSource2: ReadOnlyElementsSource
      let elementSource: ReadOnlyElementsSource
      beforeEach(() => {
        fallbackSource1 = buildElementsSourceFromElements([
          new ObjectType({
            elemID: new ElemID('adapter', 'type1'),
            annotations: { fallback: 1 },
          }),
          new ObjectType({
            elemID: new ElemID('adapter', 'type3'),
            annotations: { fallback: 1 },
          }),
        ])

        fallbackSource2 = buildElementsSourceFromElements([
          new ObjectType({
            elemID: new ElemID('adapter', 'type3'),
            annotations: {
              fallback: 2,
            },
          }),
          new ObjectType({
            elemID: new ElemID('adapter', 'type4'),
          }),
        ])
        elementSource = buildElementsSourceFromElements(
          [
            new ObjectType({
              elemID: new ElemID('adapter', 'type1'),
              annotations: { fallback: 0 },
            }),
            new ObjectType({
              elemID: new ElemID('adapter', 'type2'),
            }),
          ],
          [fallbackSource1, fallbackSource2],
        )
      })
      it('should combine elements from both sources in list', async () => {
        const allIds = await toArrayAsync(await elementSource.list())
        expect(allIds).toContainEqual(new ElemID('adapter', 'type1'))
        expect(allIds).toContainEqual(new ElemID('adapter', 'type2'))
        expect(allIds).toContainEqual(new ElemID('adapter', 'type3'))
        expect(allIds).toContainEqual(new ElemID('adapter', 'type4'))
        expect(allIds).toHaveLength(4)
      })
      it('should return element from element list over fallback source in get', async () => {
        const elem = await elementSource.get(new ElemID('adapter', 'type1'))
        expect(elem).toBeDefined()
        expect(elem?.annotations.fallback).toEqual(0)
      })

      it('should return element from first fallback over the second fallback source in get', async () => {
        const elem = await elementSource.get(new ElemID('adapter', 'type3'))
        expect(elem).toBeDefined()
        expect(elem.annotations.fallback).toBe(1)
      })

      it('should return element from the last fallback if not exist in other sources in get', async () => {
        const elem = (await elementSource.get(new ElemID('adapter', 'type4'))) as ObjectType
        expect(elem).toBeDefined()
      })
      it('should return elements from element by fallback orders in getAll', async () => {
        elements = await toArrayAsync(await elementSource.getAll())
        expect(elements).toHaveLength(4)
        const elementsByName = _.keyBy(elements, elem => elem.elemID.typeName)
        expect(elementsByName).toHaveProperty('type1')
        expect(elementsByName).toHaveProperty('type2')
        expect(elementsByName).toHaveProperty('type3')
        expect(elementsByName).toHaveProperty('type4')
        expect(elementsByName.type1.annotations.fallback).toBe(0)
        expect(elementsByName.type3.annotations.fallback).toBe(1)
      })
      it('should contain elements that exist only in elements list', async () => {
        await expect(elementSource.has(new ElemID('adapter', 'type2'))).resolves.toEqual(true)
      })
      it('should contain elements that exist only in first fallback source', async () => {
        await expect(elementSource.has(new ElemID('adapter', 'type3'))).resolves.toEqual(true)
      })

      it('should contain elements that exist only in second fallback source', async () => {
        await expect(elementSource.has(new ElemID('adapter', 'type4'))).resolves.toEqual(true)
      })
      it('should not contain elements that do not exist', async () => {
        await expect(elementSource.get(new ElemID('adapter', 'none'))).resolves.toBeUndefined()
        await expect(elementSource.has(new ElemID('adapter', 'none'))).resolves.toEqual(false)
      })
    })
  })
  describe('buildLazyShallowTypeResolverElementsSource', () => {
    const UNRESOLVED_FIELD_NAME = 'unresolvedField'
    let resolveTypeShallowSpy: jest.SpyInstance
    let unresolvedType: ObjectType
    beforeEach(() => {
      unresolvedType = new ObjectType({
        elemID: new ElemID('adapter', 'unresolvedType'),
      })
      resolveTypeShallowSpy = jest.spyOn(utilsModule, 'resolveTypeShallow')
      objectType = new ObjectType({
        elemID: new ElemID('adapter', 'type1'),
        fields: {
          [UNRESOLVED_FIELD_NAME]: {
            refType: new TypeReference(unresolvedType.elemID, undefined),
          },
        },
      })
      const originalElementsSource = buildElementsSourceFromElements([objectType, unresolvedType])
      elementsSource = buildLazyShallowTypeResolverElementsSource(originalElementsSource)
    })
    it('should resolve the type shallowly once', async () => {
      const resolvedElement = await elementsSource.get(objectType.elemID)
      expect(resolvedElement.fields[UNRESOLVED_FIELD_NAME]?.refType).toEqual(
        new TypeReference(unresolvedType.elemID, unresolvedType),
      )
      expect(resolvedElement).toEqual(await elementsSource.get(objectType.elemID))
      const callsOnTheObjectType = resolveTypeShallowSpy.mock.calls.filter(args => args[0] === objectType)
      expect(callsOnTheObjectType).toHaveLength(1)
    })
  })
  describe('filterElementsSource', () => {
    const ACCOUNT1 = 'account1'
    const ACCOUNT2 = 'account2'
    let account1Element: Element
    let account2Element: Element
    let anotherAccount2Element: Element
    let globalElement: Element
    beforeEach(() => {
      account1Element = new ObjectType({ elemID: new ElemID(ACCOUNT1, 'type1') })
      account2Element = new ObjectType({ elemID: new ElemID(ACCOUNT2, 'type1') })
      anotherAccount2Element = new ObjectType({ elemID: new ElemID(ACCOUNT2, 'type2') })
      globalElement = new ObjectType({ elemID: new ElemID(GLOBAL_ADAPTER, 'globalType') })
    })
    it('should return only elements from the specified account and the global adapter', async () => {
      const filteredElementsSource = filterElementsSource(
        buildElementsSourceFromElements([account1Element, account2Element, anotherAccount2Element, globalElement]),
        ACCOUNT2,
      )
      expect(await toArrayAsync(await filteredElementsSource.getAll())).toEqual([
        account2Element,
        anotherAccount2Element,
        globalElement,
      ])
    })
  })
  describe('createElemIDReplacedElementsSource', () => {
    it('should return the original elements source when the account name is the adapter name', async () => {
      const source = buildElementsSourceFromElements([new ObjectType({ elemID: new ElemID('adapter', 'type1') })])
      expect(createElemIDReplacedElementsSource(source, 'adapter', 'adapter')).toBe(source)
    })
    it('should return a new elements source with replaced elemIDs when the account name is different from the adapter name', async () => {
      const source = buildElementsSourceFromElements([new ObjectType({ elemID: new ElemID('account', 'type1') })])
      const replacedSource = createElemIDReplacedElementsSource(source, 'account', 'adapter')
      const replacedElements = await toArrayAsync(await replacedSource.getAll())
      expect(replacedElements).toHaveLength(1)
      expect(replacedElements[0].elemID.getFullName()).toEqual('adapter.type1')
    })
  })
})
