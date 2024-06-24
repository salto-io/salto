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
import {
  ElemID,
  InstanceElement,
  ObjectType,
  PlaceholderObjectType,
  ReadOnlyElementsSource,
  TypeReference,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { buildElementsSourceFromElements, buildLazyShallowTypeResolverElementsSource } from '../src/element_source'
import * as utilsModule from '../src/utils'

const { toArrayAsync } = collections.asynciterable

describe('elementSource', () => {
  describe('buildElementsSourceFromElements', () => {
    describe('when built from elements', () => {
      const elements = [
        new ObjectType({ elemID: new ElemID('adapter', 'type1') }),
        new ObjectType({ elemID: new ElemID('adapter', 'type2') }),
      ]
      const elementsSource = buildElementsSourceFromElements(elements)

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
          expect(await elementsSource.get(new ElemID('adapter', 'type3'))).toBeUndefined()
        })
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
          expect(await elementsSource.has(new ElemID('adapter', 'type3'))).toBeFalsy()
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
        const elements = await toArrayAsync(await elementSource.getAll())
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
    let objectType: ObjectType
    let elementsSource: ReadOnlyElementsSource
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
})
