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
import {
  ChangeGroupId,
  ChangeId,
  ElemID,
  InstanceElement,
  ObjectType,
  toChange,
  CORE_ANNOTATIONS,
  Change,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { ZENDESK } from '../src/constants'
import { getChangeGroupIds } from '../src/group_change'

describe('Group changes function', () => {
  const groupObjType = new ObjectType({ elemID: new ElemID(ZENDESK, 'group') })
  const groupInstance1 = new InstanceElement('group1', groupObjType)
  const groupInstance2 = new InstanceElement('group2', groupObjType)
  const ticketFieldObjType = new ObjectType({ elemID: new ElemID(ZENDESK, 'ticket_field') })
  const ticketFieldOptionObjType = new ObjectType({ elemID: new ElemID(ZENDESK, 'ticket_field__custom_field_options') })
  const ticketField1 = new InstanceElement('ticketField1', ticketFieldObjType, {
    id: 1,
    name: 'ticketField1',
    custom_field_options: [
      new ReferenceExpression(new ElemID(ZENDESK, ticketFieldOptionObjType.elemID.typeName, 'instance', 'option1')),
    ],
  })
  const option1 = new InstanceElement(
    'option1',
    ticketFieldOptionObjType,
    { id: 2, name: 'option1', value: 'v1' },
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(ticketField1.elemID, ticketField1)] },
  )
  const ticketField2 = new InstanceElement('ticketField2', ticketFieldObjType, {
    id: 3,
    name: 'ticketField2',
    custom_field_options: [
      new ReferenceExpression(new ElemID(ZENDESK, ticketFieldOptionObjType.elemID.typeName, 'instance', 'option2')),
    ],
  })
  const option2 = new InstanceElement(
    'option2',
    ticketFieldOptionObjType,
    { id: 4, name: 'option2', value: 'v2' },
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(ticketField2.elemID, ticketField2)] },
  )
  let changeGroupIds: Map<ChangeId, ChangeGroupId>

  beforeAll(async () => {
    changeGroupIds = (
      await getChangeGroupIds(
        new Map<string, Change>([
          [ticketFieldObjType.elemID.getFullName(), toChange({ after: ticketFieldObjType })],
          [groupInstance1.elemID.getFullName(), toChange({ after: groupInstance1 })],
          [ticketField1.elemID.getFullName(), toChange({ after: ticketField1 })],
          [option1.elemID.getFullName(), toChange({ after: option1 })],
          [ticketField2.elemID.getFullName(), toChange({ after: ticketField2 })],
          [option2.elemID.getFullName(), toChange({ after: option2 })],
          [groupInstance2.elemID.getFullName(), toChange({ before: groupInstance2 })],
        ]),
      )
    ).changeGroupIdMap
  })

  describe('groups by type', () => {
    it('should have one group for all related changes of specific type', () => {
      expect(changeGroupIds.get(groupInstance1.elemID.getFullName())).toEqual(
        changeGroupIds.get(groupInstance2.elemID.getFullName()),
      )
      expect(changeGroupIds.get(groupInstance1.elemID.getFullName())).toEqual('group')
    })
    it('should group object type by its type name', () => {
      expect(changeGroupIds.get(ticketFieldObjType.elemID.getFullName())).toEqual('ticket_field')
    })
  })

  describe('groups for recurse into types', () => {
    it('should have the same group id for an instance and its children', () => {
      expect(changeGroupIds.get(ticketField1.elemID.getFullName())).toEqual(
        changeGroupIds.get(option1.elemID.getFullName()),
      )
      expect(changeGroupIds.get(ticketField1.elemID.getFullName())).toEqual(ticketField1.elemID.getFullName())
    })
    it('should have different group for two recurse into parents', () => {
      expect(changeGroupIds.get(ticketField1.elemID.getFullName())).not.toEqual(
        changeGroupIds.get(ticketField2.elemID.getFullName()),
      )
      expect(changeGroupIds.get(ticketField1.elemID.getFullName())).toEqual(ticketField1.elemID.getFullName())
      expect(changeGroupIds.get(ticketField2.elemID.getFullName())).toEqual(ticketField2.elemID.getFullName())
    })
  })
})
