/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ObjectType, Element, BuiltinTypes, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import filterCreator from '../../src/filters/add_root_folder'
import { WORKATO } from '../../src/constants'
import { getFilterParams } from '../utils'

describe('Add root filter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType

  beforeAll(() => {
    filter = filterCreator(getFilterParams()) as FilterType
  })

  const connectionType = new ObjectType({
    elemID: new ElemID(WORKATO, 'connection'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER, annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true } },
    },
  })
  const folderType = new ObjectType({
    elemID: new ElemID(WORKATO, 'folder'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER, annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true } },
      parent_id: { refType: BuiltinTypes.NUMBER },
    },
  })

  const generateElements = (): Element[] => [
    connectionType,
    new InstanceElement('conn123', connectionType, { id: 123 }),
    folderType,
    new InstanceElement('folder11', folderType, { id: 11, parent_id: 55 }),
    new InstanceElement('folder222', folderType, { id: 22, parent_id: 11 }),
    new InstanceElement('folder222', folderType, { id: 33, parent_id: 55 }),
  ]

  describe('on fetch', () => {
    it('should create a root folder when exactly one parent id does not exist', async () => {
      const elements = generateElements()
      const lengthBefore = elements.length
      await filter.onFetch(elements)
      expect(elements.length).toEqual(lengthBefore + 1)
      const rootFolder = elements.find(
        e => e.elemID.getFullName() === 'workato.folder.instance.Root',
      ) as InstanceElement
      expect(rootFolder).toBeInstanceOf(InstanceElement)
      expect(rootFolder.value).toEqual({ id: 55, name: 'Root' })
    })

    it('should not create a root folder if all parents already exist', async () => {
      const elements = generateElements()
      elements.push(new InstanceElement('aaa', folderType, { id: 55, parent_id: 11 }))
      const lengthBefore = elements.length
      await filter.onFetch(elements)
      expect(elements.length).toEqual(lengthBefore)
      const rootFolder = elements.find(e => e.elemID.getFullName() === 'workato.folder.instance.Root')
      expect(rootFolder).toBeUndefined()
    })

    it('should not create a root folder if all parents already exist and some parent ids are missing', async () => {
      const elements = generateElements()
      elements.push(new InstanceElement('aaa', folderType, { id: 55 }))
      const lengthBefore = elements.length
      await filter.onFetch(elements)
      expect(elements.length).toEqual(lengthBefore)
      const rootFolder = elements.find(e => e.elemID.getFullName() === 'workato.folder.instance.Root')
      expect(rootFolder).toBeUndefined()
    })

    it('should not create a root folder if multiple parents are missing', async () => {
      const elements = generateElements()
      elements.push(new InstanceElement('aaa', folderType, { id: 44, parent_id: 56 }))
      const lengthBefore = elements.length
      await filter.onFetch(elements)
      expect(elements.length).toEqual(lengthBefore)
      const rootFolder = elements.find(e => e.elemID.getFullName() === 'workato.folder.instance.Root')
      expect(rootFolder).toBeUndefined()
    })

    it('should do nothing if folder type is missing', async () => {
      const elements = generateElements().filter(e => e.elemID.typeName !== 'folder')
      const lengthBefore = elements.length
      await filter.onFetch(elements)
      expect(elements.length).toEqual(lengthBefore)
      const rootFolder = elements.find(e => e.elemID.getFullName() === 'workato.folder.instance.Root')
      expect(rootFolder).toBeUndefined()
    })
  })
})
