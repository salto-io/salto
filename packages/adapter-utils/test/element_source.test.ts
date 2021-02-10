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

import { ElemID, ObjectType } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { buildElementsSourceFromElements } from '../src/element_source'

describe('buildElementsSourceFromElements', () => {
  const elements = [
    new ObjectType({ elemID: new ElemID('adapter', 'type1') }),
    new ObjectType({ elemID: new ElemID('adapter', 'type2') }),
  ]

  const elementsSource = buildElementsSourceFromElements(elements)

  describe('getAll', () => {
    it('should return all the elements', async () => {
      const recievedElements = await collections.asynciterable
        .toArrayAsync(await elementsSource.getAll())
      expect(recievedElements).toEqual(elements)
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
      const recievedElementsIds = await collections.asynciterable
        .toArrayAsync(await elementsSource.list())
      expect(recievedElementsIds).toEqual(elements.map(e => e.elemID))
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
