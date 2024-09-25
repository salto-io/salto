/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  ElemID,
  InstanceElement,
  ObjectType,
  BuiltinTypes,
  CORE_ANNOTATIONS,
  ReferenceExpression,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { WORKATO } from '../../src/constants'
import commonCreators from '../../src/filters/common'
import { getFilterParams } from '../utils'

const filterCreator = commonCreators.referencedInstanceNames

describe('referenced id fields filter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType

  const recipeType = new ObjectType({
    elemID: new ElemID(WORKATO, 'recipe'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER, annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true } },
      folder_id: { refType: BuiltinTypes.NUMBER },
      code: { refType: BuiltinTypes.UNKNOWN },
    },
  })
  const recipeCodeType = new ObjectType({
    elemID: new ElemID(WORKATO, 'recipe__code'),
  })
  const folderType = new ObjectType({
    elemID: new ElemID(WORKATO, 'folder'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER, annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true } },
      parent_id: { refType: BuiltinTypes.NUMBER },
    },
  })
  const rootFolder = new InstanceElement('Root', folderType, { name: 'Root', id: 55 }) // root folder
  const folder11 = new InstanceElement('folder11_55', folderType, {
    name: 'folder11',
    id: 11,
    parent_id: new ReferenceExpression(rootFolder.elemID, rootFolder),
  })
  const recipe123 = new InstanceElement(
    'recipe123',
    recipeType,
    {
      name: 'recipe123',
      id: 123,
      folder_id: new ReferenceExpression(folder11.elemID, folder11),
      code: new ReferenceExpression(new ElemID('workato', 'recipe__code', 'instance', 'recipe123_')),
    },
    ['Records', 'recipe', 'recipe123'],
  )
  const recipeCode123 = new InstanceElement(
    'recipe123_',
    recipeCodeType,
    { id: 123 },
    ['Records', 'recipe__code', 'recipe123_'],
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(recipe123.elemID, recipe123)] },
  )
  const folder22 = new InstanceElement('folder22_11', folderType, {
    name: 'folder22',
    id: 22,
    parent_id: new ReferenceExpression(folder11.elemID, folder11),
  })
  const folder33 = new InstanceElement('folder33_55', folderType, {
    name: 'folder33',
    id: 33,
    parent_id: new ReferenceExpression(rootFolder.elemID, rootFolder),
  })

  it('should resolve ids in instances names according to elemID definitions', async () => {
    const elements = [
      folderType,
      recipeType,
      recipeCodeType,
      recipeCode123,
      folder11,
      folder22,
      rootFolder,
      recipe123,
      folder33,
    ]
    const lengthBefore = elements.length
    filter = filterCreator(getFilterParams()) as FilterType
    await filter.onFetch(elements)
    expect(elements.length).toEqual(lengthBefore)
    const instances = elements.filter(isInstanceElement)
    expect(instances.map(e => e.elemID.getFullName()).sort()).toEqual([
      'workato.folder.instance.Root',
      'workato.folder.instance.folder11_Root',
      'workato.folder.instance.folder22_folder11_Root',
      'workato.folder.instance.folder33_Root',
      'workato.recipe.instance.recipe123_folder11_Root',
      'workato.recipe__code.instance.recipe123_folder11_Root',
    ])
  })
})
