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
import { ObjectType, ElemID, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'

import { ZENDESK } from '../../src/constants'

import filterCreator, { RESTRICTION_FIELD_NAME } from '../../src/filters/restriction'
import { createFilterCreatorParams } from '../utils'

describe('restriction filter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType
  const viewObjType = new ObjectType({ elemID: new ElemID(ZENDESK, 'view') })
  const workspaceObjType = new ObjectType({ elemID: new ElemID(ZENDESK, 'workspace') })
  const viewInst1 = new InstanceElement('view1', viewObjType, {
    id: 11,
    name: 'view1',
    [RESTRICTION_FIELD_NAME]: { type: 'Group', id: 1, ids: [1, 2] },
  })
  const viewInst2 = new InstanceElement('view2', viewObjType, {
    id: 12,
    name: 'view2',
    [RESTRICTION_FIELD_NAME]: { type: 'User', id: 3 },
  })
  const workspaceInst1 = new InstanceElement('workspace1', workspaceObjType, {
    id: 13,
    name: 'workspace1',
    selected_macros: [{ id: 5 }, { id: 6, [RESTRICTION_FIELD_NAME]: { type: 'Group', id: 1, ids: [1, 2] } }],
  })

  beforeEach(async () => {
    jest.clearAllMocks()
    filter = filterCreator(createFilterCreatorParams({})) as FilterType
  })

  describe('onFetch', () => {
    it('should remove redundant restriction fields', async () => {
      const elements = [viewObjType, workspaceObjType, viewInst1, viewInst2, workspaceInst1].map(e => e.clone())
      await filter.onFetch(elements)
      expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual([
        'zendesk.view',
        'zendesk.view.instance.view1',
        'zendesk.view.instance.view2',
        'zendesk.workspace',
        'zendesk.workspace.instance.workspace1',
      ])
      expect(elements.filter(isInstanceElement).map(e => e.value)).toEqual([
        { id: 11, name: 'view1', [RESTRICTION_FIELD_NAME]: { type: 'Group', ids: [1, 2] } },
        { id: 12, name: 'view2', [RESTRICTION_FIELD_NAME]: { type: 'User', id: 3 } },
        {
          id: 13,
          name: 'workspace1',
          selected_macros: [{ id: 5 }, { id: 6, [RESTRICTION_FIELD_NAME]: { type: 'Group', ids: [1, 2] } }],
        },
      ])
    })
  })
})
