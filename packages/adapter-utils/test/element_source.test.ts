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
import _ from 'lodash'
import { ElemID, ObjectType, ReadOnlyElementsSource } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { buildElementsSourceFromElements } from '../src/element_source'

const { toArrayAsync } = collections.asynciterable

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
        const receivedElementsIds = await collections.asynciterable
          .toArrayAsync(await elementsSource.list())
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
    let fallbackSource: ReadOnlyElementsSource
    let elementSource: ReadOnlyElementsSource
    beforeEach(() => {
      fallbackSource = buildElementsSourceFromElements([
        new ObjectType({
          elemID: new ElemID('adapter', 'type1'),
          annotations: { fallback: true },
        }),
        new ObjectType({
          elemID: new ElemID('adapter', 'type3'),
        }),
      ])
      elementSource = buildElementsSourceFromElements(
        [
          new ObjectType({
            elemID: new ElemID('adapter', 'type1'),
            annotations: { fallback: false },
          }),
          new ObjectType({
            elemID: new ElemID('adapter', 'type2'),
          }),
        ],
        fallbackSource,
      )
    })
    it('should combine elements from both sources in list', async () => {
      const allIds = await toArrayAsync(await elementSource.list())
      expect(allIds).toContainEqual(new ElemID('adapter', 'type1'))
      expect(allIds).toContainEqual(new ElemID('adapter', 'type2'))
      expect(allIds).toContainEqual(new ElemID('adapter', 'type3'))
      expect(allIds).toHaveLength(3)
    })
    it('should return element from element list over fallback source in get', async () => {
      const elem = await elementSource.get(new ElemID('adapter', 'type1'))
      expect(elem).toBeDefined()
      expect(elem?.annotations.fallback).toEqual(false)
    })
    it('should return elements from element list over fallback source in getAll', async () => {
      const elements = await toArrayAsync(await elementSource.getAll())
      expect(elements).toHaveLength(3)
      const elementsByName = _.keyBy(elements, elem => elem.elemID.typeName)
      expect(elementsByName).toHaveProperty('type1')
      expect(elementsByName.type1.annotations.fallback).toEqual(false)
    })
    it('should contain elements that exist only in elements list', async () => {
      await expect(elementSource.has(new ElemID('adapter', 'type2'))).resolves.toEqual(true)
    })
    it('should contain elements that exist only in fallback source', async () => {
      await expect(elementSource.has(new ElemID('adapter', 'type3'))).resolves.toEqual(true)
    })
    it('should not contain elements that do not exist', async () => {
      await expect(elementSource.get(new ElemID('adapter', 'none'))).resolves.toBeUndefined()
      await expect(elementSource.has(new ElemID('adapter', 'none'))).resolves.toEqual(false)
    })
  })
})
