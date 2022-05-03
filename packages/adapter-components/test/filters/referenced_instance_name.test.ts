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

import { ElemID, InstanceElement, ObjectType, ReferenceExpression, Element, BuiltinTypes, isInstanceElement } from '@salto-io/adapter-api'
import { references } from '@salto-io/adapter-utils'
import { addReferencesToInstanceNames, updateAllReferences, referencedInstanceNamesFilterCreator } from '../../src/filters/referenced_instance_names'
import { FilterWith } from '../../src/filter_utils'
import { Paginator } from '../../src/client'
import { createMockQuery } from '../../src/elements/query'

const { getReferences } = references
const ADAPTER_NAME = 'myAdapter'

describe('referenced instances', () => {
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
    const sameRecipeOne = new InstanceElement(
      'sameRecipe',
      recipeType,
      {
        name: '12345',
        book_id: new ReferenceExpression(rootBook.elemID, rootBook),
      },
    )
    const sameRecipeTwo = new InstanceElement(
      'sameRecipe',
      recipeType,
      {
        name: '54321',
        book_id: new ReferenceExpression(rootBook.elemID, rootBook),
      },
    )
    const lastRecipe = new InstanceElement(
      'last',
      recipeType,
      {
        name: 'lastRecipe',
        book_id: new ReferenceExpression(anotherBook.elemID, anotherBook),
      },
    )
    return [recipeType, bookType, ...recipes, anotherBook, rootBook,
      sameRecipeOne, sameRecipeTwo, lastRecipe]
  }
  const config = {
    apiDefinitions: {
      types: {
        book: {
          transformation: {
            idFields: ['id', '&parent_book_id'],
          },
        },
        recipe: {
          transformation: {
            idFields: ['name', '&book_id'],
          },
        },
      },
      typeDefaults: {
        transformation: {
          idFields: ['id'],
        },
      },
      supportedTypes: {},
    },
  }
  let elements: Element[]

  describe('referencedInstanceNames filter', () => {
    type FilterType = FilterWith<'onFetch'>
    let filter: FilterType

    beforeEach(async () => {
      jest.clearAllMocks()
      filter = referencedInstanceNamesFilterCreator()({
        client: {} as unknown,
        paginator: undefined as unknown as Paginator,
        config,
        fetchQuery: createMockQuery(),
      }) as FilterType
    })
    it('should rename the elements correctly when the filter is called', async () => {
      elements = generateElements()
      await filter.onFetch(elements)
      expect(elements
        .filter(isInstanceElement)
        .map(e => e.elemID.getFullName()).sort())
        .toEqual(['myAdapter.book.instance.123_ROOT',
          'myAdapter.book.instance.456_123_ROOT',
          'myAdapter.recipe.instance.lastRecipe_456_123_ROOT',
          'myAdapter.recipe.instance.recipe123_123_ROOT',
          'myAdapter.recipe.instance.recipe456_456_123_ROOT',
          'myAdapter.recipe.instance.sameRecipe',
          'myAdapter.recipe.instance.sameRecipe',
        ])
    })
  })

  describe('addReferencesToInstanceNames function', () => {
    const transformationDefaultConfig = config.apiDefinitions.typeDefaults.transformation
    const transformationConfigByType = {
      recipe: config.apiDefinitions.types.recipe.transformation,
      book: config.apiDefinitions.types.book.transformation,
    }
    beforeAll(() => {
      elements = generateElements()
    })
    it('should change name and references correctly', async () => {
      const result = await addReferencesToInstanceNames(
        elements.slice(0, 6),
        transformationConfigByType,
        transformationDefaultConfig
      )
      expect(result.length).toEqual(6)
      expect(result
        .filter(isInstanceElement)
        .map(i => i.elemID.getFullName()).sort())
        .toEqual(['myAdapter.book.instance.123_ROOT',
          'myAdapter.book.instance.456_123_ROOT',
          'myAdapter.recipe.instance.recipe123_123_ROOT',
          'myAdapter.recipe.instance.recipe456_456_123_ROOT',
        ])
    })
    it('should not change name for duplicate elemIDs', async () => {
      const result = await addReferencesToInstanceNames(
        elements.slice(0, 2).concat(elements.slice(4)),
        transformationConfigByType,
        transformationDefaultConfig
      )
      expect(result.length).toEqual(7)
      expect(result
        .map(e => e.elemID.getFullName()).sort())
        .toEqual(['myAdapter.book',
          'myAdapter.book.instance.123_ROOT',
          'myAdapter.book.instance.456_123_ROOT',
          'myAdapter.recipe',
          'myAdapter.recipe.instance.lastRecipe_456_123_ROOT',
          'myAdapter.recipe.instance.sameRecipe',
          'myAdapter.recipe.instance.sameRecipe',
        ])
    })
  })

  describe('updateAllReferences function', () => {
    it('should change all references to from old ElemID to new ElemID', () => {
      elements = generateElements()
      const newElemID = new ElemID(ADAPTER_NAME, 'book', 'instance', 'newRootBook')
      const instances = elements.filter(isInstanceElement)
      updateAllReferences(instances, elements[5].elemID, newElemID)
      const newReferences = instances.map(instance => getReferences(instance, newElemID)).flat()
      expect(newReferences.length).toEqual(4)
      expect(newReferences[0].path.getFullName()).toEqual('myAdapter.recipe.instance.recipe123.book_id')
      expect(newReferences[1].path.getFullName()).toEqual('myAdapter.book.instance.book.parent_book_id')
      expect(newReferences[2].path.getFullName()).toEqual('myAdapter.recipe.instance.sameRecipe.book_id')
      expect(newReferences[3].path.getFullName()).toEqual('myAdapter.recipe.instance.sameRecipe.book_id')
    })
  })
})
