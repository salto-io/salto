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
import { ElemID, InstanceElement, ObjectType, Element, BuiltinTypes, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils } from '@salto-io/adapter-components'
import filterCreator from '../../src/filters/add_root_folder'
import WorkatoClient from '../../src/client/client'
import { paginate } from '../../src/client/pagination'
import { DEFAULT_TYPES, DEFAULT_ID_FIELDS } from '../../src/config'
import { WORKATO } from '../../src/constants'


describe('Field references filter', () => {
  let client: WorkatoClient
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType

  beforeAll(() => {
    client = new WorkatoClient({
      credentials: { username: 'a', token: 'b' },
    })
    filter = filterCreator({
      client,
      paginator: clientUtils.createPaginator({
        client,
        paginationFuncCreator: paginate,
      }),
      config: {
        fetch: {
          includeTypes: ['connection', 'folder'],
        },
        apiDefinitions: {
          typeDefaults: {
            transformation: {
              idFields: DEFAULT_ID_FIELDS,
            },
          },
          types: DEFAULT_TYPES,
        },
      },
    }) as FilterType
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
      // eslint-disable-next-line camelcase
      parent_id: { refType: BuiltinTypes.NUMBER },
    },
  })

  const generateElements = (
  ): Element[] => ([
    connectionType,
    new InstanceElement('conn123', connectionType, { id: 123 }),
    folderType,
    new InstanceElement('folder11', folderType, { id: 11, parent_id: 55 }),
    new InstanceElement('folder222', folderType, { id: 22, parent_id: 11 }),
    new InstanceElement('folder222', folderType, { id: 33, parent_id: 55 }),
  ])

  describe('on fetch', () => {
    it('should create a root folder when exactly one parent id does not exist', async () => {
      const elements = generateElements()
      const lengthBefore = elements.length
      await filter.onFetch(elements)
      expect(elements.length).toEqual(lengthBefore + 1)
      const rootFolder = elements.find(e => e.elemID.getFullName() === 'workato.folder.instance.ROOT') as InstanceElement
      expect(rootFolder).toBeInstanceOf(InstanceElement)
      expect(rootFolder.value).toEqual({ id: 55, name: 'ROOT' })
    })

    it('should not create a root folder if all parents already exist', async () => {
      const elements = generateElements()
      elements.push(new InstanceElement('aaa', folderType, { id: 55, parent_id: 11 }))
      const lengthBefore = elements.length
      await filter.onFetch(elements)
      expect(elements.length).toEqual(lengthBefore)
      const rootFolder = elements.find(e => e.elemID.getFullName() === 'workato.folder.instance.ROOT')
      expect(rootFolder).toBeUndefined()
    })

    it('should not create a root folder if all parents already exist and some parent ids are missing', async () => {
      const elements = generateElements()
      elements.push(new InstanceElement('aaa', folderType, { id: 55 }))
      const lengthBefore = elements.length
      await filter.onFetch(elements)
      expect(elements.length).toEqual(lengthBefore)
      const rootFolder = elements.find(e => e.elemID.getFullName() === 'workato.folder.instance.ROOT')
      expect(rootFolder).toBeUndefined()
    })

    it('should not create a root folder if multiple parents are missing', async () => {
      const elements = generateElements()
      elements.push(new InstanceElement('aaa', folderType, { id: 44, parent_id: 56 }))
      const lengthBefore = elements.length
      await filter.onFetch(elements)
      expect(elements.length).toEqual(lengthBefore)
      const rootFolder = elements.find(e => e.elemID.getFullName() === 'workato.folder.instance.ROOT')
      expect(rootFolder).toBeUndefined()
    })

    it('should do nothing if folder type is missing', async () => {
      const elements = generateElements().filter(e => e.elemID.typeName !== 'folder')
      const lengthBefore = elements.length
      await filter.onFetch(elements)
      expect(elements.length).toEqual(lengthBefore)
      const rootFolder = elements.find(e => e.elemID.getFullName() === 'workato.folder.instance.ROOT')
      expect(rootFolder).toBeUndefined()
    })
  })
})
