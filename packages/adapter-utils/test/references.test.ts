/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, BuiltinTypes, ObjectType, InstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import { transformElement } from '../src/utils'
import {
  getUpdatedReference,
  getReferences,
  createReferencesTransformFunc,
  isArrayOfRefExprToInstances,
} from '../src/references'

const ADAPTER_NAME = 'myAdapter'

describe('references functions', () => {
  const recipeType = new ObjectType({
    elemID: new ElemID(ADAPTER_NAME, 'recipe'),
    fields: {
      name: { refType: BuiltinTypes.STRING },
      book_id: { refType: BuiltinTypes.NUMBER },
      main_book_id: { refType: BuiltinTypes.NUMBER },
    },
  })
  const bookType = new ObjectType({
    elemID: new ElemID(ADAPTER_NAME, 'book'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
      parent_book_id: { refType: BuiltinTypes.NUMBER },
    },
  })
  const mainBook = new InstanceElement('rootBook', bookType, {
    id: 101,
    parent_book_id: 'ROOT',
  })
  const recipes = [
    new InstanceElement('recipe123', recipeType, {
      name: 'chamber of secrets',
      book_id: new ReferenceExpression(mainBook.elemID, mainBook),
      main_book_id: new ReferenceExpression(mainBook.elemID, mainBook),
    }),
    new InstanceElement('recipe456', recipeType, {
      name: 'order of phoenix',
      book_id: new ReferenceExpression(mainBook.elemID, mainBook),
    }),
  ]

  it('should find all references of element', () => {
    const refs = getReferences(recipes[0], mainBook.elemID)
    expect(refs.length).toEqual(2)
    expect(refs[0].value.elemID).toEqual(mainBook.elemID)
    expect(refs[1].value.elemID).toEqual(mainBook.elemID)

    const newElemID = new ElemID(ADAPTER_NAME, 'book', 'instance', 'very_new_book')
    refs.forEach(ref => {
      const updatedReference = getUpdatedReference(ref.value, newElemID)
      expect(updatedReference.elemID).toEqual(newElemID)
    })
  })

  it('should replace the old elemID with the new one in the returned instance', async () => {
    const newElemID = new ElemID(ADAPTER_NAME, 'book', 'instance', 'very_new_book')
    const updatedInstance = await transformElement({
      element: recipes[0],
      transformFunc: createReferencesTransformFunc(mainBook.elemID, newElemID),
      strict: false,
    })
    expect(updatedInstance.value.book_id.elemID).toEqual(newElemID)
  })
  describe('isArrayOfRefExprToInstances', () => {
    const bookRef = new ReferenceExpression(mainBook.elemID, mainBook)
    const otherBookRef = new ReferenceExpression(mainBook.elemID, mainBook)
    it('should return True because elements are references or an empty list', () => {
      expect(isArrayOfRefExprToInstances([bookRef, otherBookRef])).toBe(true)
      expect(isArrayOfRefExprToInstances([])).toBe(true)
    })
    it('should return False because its elements are not only references or not references at all', () => {
      const newElemID = new ElemID(ADAPTER_NAME, 'book', 'instance', 'very_new_book')
      expect(isArrayOfRefExprToInstances([bookRef, newElemID])).toBe(false)
      expect(isArrayOfRefExprToInstances(['hello', 3])).toBe(false)
    })
  })
})
