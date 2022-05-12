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
import { ObjectType, ElemID, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils, elements as elementUtils } from '@salto-io/adapter-components'
import { DEFAULT_CONFIG } from '../../src/config'
import ZendeskClient from '../../src/client/client'
import { ZENDESK_SUPPORT } from '../../src/constants'
import { paginate } from '../../src/client/pagination'
import filterCreator, { RESTRICTION_FIELD_NAME } from '../../src/filters/restriction'

describe('restriction filter', () => {
  let client: ZendeskClient
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType
  const viewObjType = new ObjectType({ elemID: new ElemID(ZENDESK_SUPPORT, 'view') })
  const workspaceObjType = new ObjectType({ elemID: new ElemID(ZENDESK_SUPPORT, 'workspace') })
  const viewInst1 = new InstanceElement(
    'view1',
    viewObjType,
    {
      id: 11,
      name: 'view1',
      [RESTRICTION_FIELD_NAME]: { type: 'Group', id: 1, ids: [1, 2] },
    },
  )
  const viewInst2 = new InstanceElement(
    'view2',
    viewObjType,
    {
      id: 12,
      name: 'view2',
      [RESTRICTION_FIELD_NAME]: { type: 'User', id: 3 },
    },
  )
  const workspaceInst1 = new InstanceElement(
    'workspace1',
    workspaceObjType,
    {
      id: 13,
      name: 'workspace1',
      selected_macros: [
        { id: 5 },
        { id: 6, [RESTRICTION_FIELD_NAME]: { type: 'Group', id: 1, ids: [1, 2] } },
      ],
    },
  )

  beforeEach(async () => {
    jest.clearAllMocks()
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
    })
    filter = filterCreator({
      client,
      paginator: clientUtils.createPaginator({
        client,
        paginationFuncCreator: paginate,
      }),
      config: DEFAULT_CONFIG,
      fetchQuery: elementUtils.query.createMockQuery(),
    }) as FilterType
  })

  describe('onFetch', () => {
    it('should remove redundant restriction fields', async () => {
      const elements = [viewObjType, workspaceObjType, viewInst1, viewInst2, workspaceInst1]
        .map(e => e.clone())
      await filter.onFetch(elements)
      expect(elements.map(e => e.elemID.getFullName()).sort())
        .toEqual([
          'zendesk_support.view',
          'zendesk_support.view.instance.view1',
          'zendesk_support.view.instance.view2',
          'zendesk_support.workspace',
          'zendesk_support.workspace.instance.workspace1',
        ])
      expect(elements.filter(isInstanceElement).map(e => e.value))
        .toEqual([
          { id: 11, name: 'view1', [RESTRICTION_FIELD_NAME]: { type: 'Group', ids: [1, 2] } },
          { id: 12, name: 'view2', [RESTRICTION_FIELD_NAME]: { type: 'User', id: 3 } },
          {
            id: 13,
            name: 'workspace1',
            selected_macros: [
              { id: 5 },
              { id: 6, [RESTRICTION_FIELD_NAME]: { type: 'Group', ids: [1, 2] } },
            ],
          },
        ])
    })
  })
})
