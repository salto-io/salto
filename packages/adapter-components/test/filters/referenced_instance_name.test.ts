/*
*                      Copyright 2022 Salto Labs Ltd.
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

import { ElemID, InstanceElement, ObjectType, ReferenceExpression, Element, BuiltinTypes } from '@salto-io/adapter-api'
import { references } from '@salto-io/adapter-utils'
import { addReferencesToInstanceNames } from '../../src/filters/referenced_instance_names'

const { getReferences } = references
const ADAPTER_NAME = 'myAdapter'

describe('referenced instances', () => {
  describe('addReferencesToInstanceNames', () => {
    const generateElements = (): Element[] => {
      const recipeType = new ObjectType({
        elemID: new ElemID(ADAPTER_NAME, 'recipe'),
        fields: {
          name: { refType: BuiltinTypes.STRING },
          book_id: { refType: BuiltinTypes.NUMBER },
        },
      })
      const bookType = new ObjectType({
        elemID: new ElemID(ADAPTER_NAME, 'book'),
        fields: {
          id: { refType: BuiltinTypes.NUMBER },
          parent_book_id: { refType: BuiltinTypes.NUMBER },
        },
      })
      const rootBook = new InstanceElement(
        'rootBook',
        bookType,
        {
          id: 123,
          parent_book_id: 'ROOT',
        },
      )
      const anotherBook = new InstanceElement(
        'book',
        bookType,
        {
          id: 456,
          parent_book_id: new ReferenceExpression(rootBook.elemID, rootBook),
        },
      )
      const recipes = [
        new InstanceElement(
          'recipe123',
          recipeType,
          {
            name: 'recipe123',
            book_id: new ReferenceExpression(rootBook.elemID, rootBook),
          },
        ),
        new InstanceElement(
          'recipe456',
          recipeType,
          {
            name: 'recipe456',
            book_id: new ReferenceExpression(anotherBook.elemID, anotherBook),
          },
        ),
      ]
      const cycleBookA = new InstanceElement(
        'one',
        bookType,
        {
          id: 12,
          parent_book_id: null,
        },
      )
      const cycleBookB = new InstanceElement(
        'two',
        bookType,
        {
          id: 23,
          parent_book_id: new ReferenceExpression(cycleBookA.elemID, cycleBookA),
        },
      )
      const cycleBookC = new InstanceElement(
        'three',
        bookType,
        {
          id: 31,
          parent_book_id: new ReferenceExpression(cycleBookB.elemID, cycleBookB),
        },
      )
      const coolType = new ObjectType({
        elemID: new ElemID(ADAPTER_NAME, 'cool'),
        fields: {
          id: { refType: BuiltinTypes.NUMBER },
          cool_recipe: { refType: BuiltinTypes.NUMBER },
        },
      })
      const aVeryCoolInstance = new InstanceElement(
        'wow',
        coolType,
        {
          id: 121212,
          cool_recipe: new ReferenceExpression(recipes[0].elemID, recipes[0]),
        },
      )
      const cyleRef = new ReferenceExpression(cycleBookC.elemID, cycleBookC)
      cycleBookA.value.parent_book_id = cyleRef
      return [recipeType, bookType, ...recipes, anotherBook, rootBook,
        cycleBookA, cycleBookB, cycleBookC, coolType, aVeryCoolInstance]
    }

    const transformationDefaultConfig = {
      idFields: ['id'],
    }
    const transformationConfigByType = {
      recipe: {
        idFields: ['name', '&book_id'],
      },
      book: {
        idFields: ['id', '&parent_book_id'],
      },
    }
    let elements: Element[]

    beforeAll(() => {
      elements = generateElements()
    })

    it('should change name and references correctly', async () => {
      const result = await addReferencesToInstanceNames(
        elements.slice(0, -5).concat(elements.slice(-2)),
        transformationConfigByType,
        transformationDefaultConfig
      )
      expect(result.length).toEqual(8)
      expect(result[2].elemID.name).toEqual('recipe123_123_ROOT')
      expect(result[3].elemID.name).toEqual('recipe456_456_123_ROOT')
      expect(result[4].elemID.name).toEqual('456_123_ROOT')
      expect(result[5].elemID.name).toEqual('123_ROOT')
      const ref = getReferences(result[7], result[2].elemID)
      expect(ref[0].value.elemID).toEqual(result[2].elemID)
    })
  })
})
