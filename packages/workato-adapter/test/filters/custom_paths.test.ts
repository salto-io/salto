/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ElemID, InstanceElement, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import { filterUtils, elements as elementUtils } from '@salto-io/adapter-components'
import { FOLDER_TYPE, WORKATO } from '../../src/constants'
import { getFilterParams } from '../utils'
import customPathsFilter from '../../src/filters/custom_paths'

describe('customPathsFilter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType

  const folderType = new ObjectType({
    elemID: new ElemID(WORKATO, FOLDER_TYPE),
  })
  const rootFolder = new InstanceElement('Root', folderType, { name: 'Root' }, [
    WORKATO,
    elementUtils.RECORDS_PATH,
    FOLDER_TYPE,
    'Root',
  ]) // root folder
  const underRootFolderA = new InstanceElement(
    'folderA',
    folderType,
    {
      name: 'folderA',
      id: 1,
      parent_id: new ReferenceExpression(rootFolder.elemID, rootFolder),
    },
    [WORKATO, elementUtils.RECORDS_PATH, FOLDER_TYPE, 'folderA'],
  )
  const underRootFolderB = new InstanceElement(
    'folderB',
    folderType,
    {
      name: 'folderB',
      id: 2,
      parent_id: new ReferenceExpression(rootFolder.elemID, rootFolder),
    },
    [WORKATO, elementUtils.RECORDS_PATH, FOLDER_TYPE, 'folderB'],
  )
  const underFolderA = new InstanceElement(
    'folderAA',
    folderType,
    {
      name: 'folderAA',
      id: 3,
      parent_id: new ReferenceExpression(underRootFolderA.elemID, underRootFolderA),
    },
    [WORKATO, elementUtils.RECORDS_PATH, FOLDER_TYPE, 'folderAA'],
  )

  const fetchParams = getFilterParams()

  it('should nest folders under their parent folder', async () => {
    filter = customPathsFilter(fetchParams) as FilterType
    await filter.onFetch([rootFolder, underRootFolderA, underRootFolderB, underFolderA])
    expect(rootFolder.path).toEqual([WORKATO, elementUtils.RECORDS_PATH, 'folder', 'Root'])
    expect(underRootFolderA.path).toEqual([WORKATO, elementUtils.RECORDS_PATH, 'folder', 'Root', 'folderA'])
    expect(underRootFolderB.path).toEqual([WORKATO, elementUtils.RECORDS_PATH, 'folder', 'Root', 'folderB'])
    expect(underFolderA.path).toEqual([WORKATO, elementUtils.RECORDS_PATH, 'folder', 'Root', 'folderA', 'folderAA'])
  })
})
