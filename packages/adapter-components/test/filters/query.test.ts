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
import { ObjectType, ElemID, Element, InstanceElement, ReferenceExpression, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { MockInterface } from '@salto-io/test-utils'
import { FilterWith } from '../../src/filter_utils'
import { Paginator } from '../../src/client'
import { queryFilterCreator } from '../../src/filters/query'
import { createMockQuery, ElementQuery } from '../../src/fetch/query'

describe('query filter', () => {
  let fetchQuery: MockInterface<ElementQuery>
  let elements: Element[]
  let filter: FilterWith<'onFetch'>

  const generateElements = (): Element[] => {
    const connectionType = new ObjectType({ elemID: new ElemID('salto', 'connection') })
    const conn1 = new InstanceElement('sb1', connectionType, { name: 'sandbox 1' })
    const conn2 = new InstanceElement('sb2', connectionType, { name: 'sandbox 2' })
    const folderType = new ObjectType({ elemID: new ElemID('salto', 'folder') })
    const folder1 = new InstanceElement('folder1', folderType, { name: 'folder 1' })
    const folder2 = new InstanceElement(
      'folder2',
      folderType,
      { name: 'folder 2' },
      undefined,
      { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(folder1.elemID)] },
    )
    const folder3 = new InstanceElement(
      'folder3',
      folderType,
      { name: 'folder 3' },
      undefined,
      { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(folder2.elemID)] },
    )

    const itemType = new ObjectType({ elemID: new ElemID('salto', 'item') })
    const innerType = new ObjectType({ elemID: new ElemID('salto', 'inner') })
    const item1 = new InstanceElement(
      'item1',
      itemType,
      {
        name: 'item1',
        folder_id: new ReferenceExpression(folder1.elemID),
      },
    )
    const inner1 = new InstanceElement(
      'inner1',
      innerType,
      { name: 'ignored' },
      undefined,
      { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(item1.elemID)] },
    )
    const item2 = new InstanceElement(
      'item2',
      itemType,
      {
        name: 'item2',
        folder_id: new ReferenceExpression(folder2.elemID),
      },
    )
    const inner2 = new InstanceElement(
      'inner2',
      innerType,
      { name: 'ignored' },
      undefined,
      { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(item2.elemID)] },
    )

    const extraType = new ObjectType({ elemID: new ElemID('salto', 'extra') })
    const extra1 = new InstanceElement('extra1', extraType, {})

    return [
      connectionType, conn1, conn2,
      folderType, folder1, folder2, folder3,
      itemType, innerType, item1, item2, inner1, inner2,
      extraType, extra1,
    ]
  }

  describe('onFetch', () => {
    describe('when using default config without customizations', () => {
      beforeAll(async () => {
        jest.clearAllMocks()
        fetchQuery = createMockQuery()
        elements = generateElements()
        filter = queryFilterCreator({})({
          client: {} as unknown,
          paginator: undefined as unknown as Paginator,
          config: {},
          fetchQuery,
        }) as FilterWith<'onFetch'>
      })
      it('should include all elements', async () => {
        await filter.onFetch(elements)
        expect(elements.map(e => e.elemID.getFullName())).toEqual([
          'salto.connection',
          'salto.connection.instance.sb1',
          'salto.connection.instance.sb2',
          'salto.folder',
          'salto.folder.instance.folder1',
          'salto.folder.instance.folder2',
          'salto.folder.instance.folder3',
          'salto.item',
          'salto.inner',
          'salto.item.instance.item1',
          'salto.item.instance.item2',
          'salto.inner.instance.inner1',
          'salto.inner.instance.inner2',
          'salto.extra',
          'salto.extra.instance.extra1',
        ])
      })
    })
    describe('when query excludes some instances', () => {
      beforeAll(async () => {
        jest.clearAllMocks()
        fetchQuery = createMockQuery()
        elements = generateElements()
        fetchQuery.isInstanceMatch.mockImplementation(instance => (
          instance.elemID.typeName !== 'extra'
          && instance.elemID.getFullName() !== 'salto.folder.instance.folder2'
        ))
        filter = queryFilterCreator({})({
          client: {} as unknown,
          paginator: undefined as unknown as Paginator,
          config: {},
          fetchQuery,
        }) as FilterWith<'onFetch'>
      })
      it('should only keep types and instances matching the query, including dependent instances', async () => {
        await filter.onFetch(elements)
        expect(elements.map(e => e.elemID.getFullName())).toEqual([
          'salto.connection',
          'salto.connection.instance.sb1',
          'salto.connection.instance.sb2',
          'salto.folder',
          'salto.folder.instance.folder1',
          'salto.item',
          'salto.inner',
          'salto.item.instance.item1',
          'salto.item.instance.item2',
          'salto.inner.instance.inner1',
          'salto.inner.instance.inner2',
          'salto.extra',
        ])
      })
    })
    describe('when ignoring some types and adding parent fields', () => {
      beforeAll(async () => {
        jest.clearAllMocks()
        fetchQuery = createMockQuery()
        elements = generateElements()
        fetchQuery.isInstanceMatch.mockImplementation(instance => (
          instance.elemID.typeName !== 'extra'
          && instance.elemID.getFullName() !== 'salto.folder.instance.folder2'
        ))
        filter = queryFilterCreator({
          additionalParentFields: {
            item: ['folder_id'],
          },
          typesToKeep: ['extra'],
        })({
          client: {} as unknown,
          paginator: undefined as unknown as Paginator,
          config: {},
          fetchQuery,
        }) as FilterWith<'onFetch'>
      })
      it('should only keep types and instances matching the query, including dependent instances', async () => {
        await filter.onFetch(elements)
        expect(elements.map(e => e.elemID.getFullName())).toEqual([
          'salto.connection',
          'salto.connection.instance.sb1',
          'salto.connection.instance.sb2',
          'salto.folder',
          'salto.folder.instance.folder1',
          'salto.item',
          'salto.inner',
          'salto.item.instance.item1',
          'salto.inner.instance.inner1',
          'salto.extra',
          'salto.extra.instance.extra1',
        ])
      })
    })
  })
})
