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

import { filterUtils } from '@salto-io/adapter-components'
import { ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/ticket_status_custom_status'
import { createFilterCreatorParams } from '../utils'
import { TICKET_FIELD_TYPE_NAME, ZENDESK } from '../../src/constants'

describe('ticket status custom status filter', () => {
  type FilterType = filterUtils.FilterWith<'deploy'>
  let filter: FilterType

  const ticketFieldType = new ObjectType({ elemID: new ElemID(ZENDESK, TICKET_FIELD_TYPE_NAME) })
  const ticketStatusInstance = new InstanceElement('status', ticketFieldType, {
    type: 'custom_status',
  })
  const ticketFieldInstance = new InstanceElement('Ticket_status_text', ticketFieldType, {
    type: 'text',
  })

  beforeEach(async () => {
    filter = filterCreator(createFilterCreatorParams({})) as FilterType
  })

  describe('deploy', () => {
    it('should add only the ticket status to the appliedChanges', async () => {
      const res = await filter.deploy([
        { action: 'add', data: { after: ticketStatusInstance } },
        { action: 'add', data: { after: ticketFieldInstance } },
      ])
      expect(res.leftoverChanges).toHaveLength(1)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toEqual([{ action: 'add', data: { after: ticketStatusInstance } }])
    })
    it('should not consider modify changes in appliedChanges', async () => {
      const res = await filter.deploy([
        { action: 'modify', data: { before: ticketStatusInstance, after: ticketStatusInstance } },
      ])
      expect(res.leftoverChanges).toHaveLength(1)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
    })
    it('should consider removal changes in appliedChanges', async () => {
      const res = await filter.deploy([{ action: 'remove', data: { before: ticketStatusInstance } }])
      expect(res.leftoverChanges).toHaveLength(1)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
    })
  })
})
