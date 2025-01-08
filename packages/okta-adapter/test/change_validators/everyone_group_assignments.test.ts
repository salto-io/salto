/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { toChange, ObjectType, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { everyoneGroupAssignments } from '../../src/change_validators/everyone_group_assignments'
import { OKTA, GROUP_MEMBERSHIP_TYPE_NAME } from '../../src/constants'

describe('everyoneGroupAssignments', () => {
  const groupMembersType = new ObjectType({ elemID: new ElemID(OKTA, GROUP_MEMBERSHIP_TYPE_NAME) })
  const everyoneGroup = new InstanceElement('Everyone', groupMembersType, { members: ['a', 'b', 'c'] })
  const otherGroup = new InstanceElement('Other', groupMembersType, { members: ['a'] })

  it('should return an error when modifying the Everyone group members instance', async () => {
    expect(await everyoneGroupAssignments([toChange({ before: everyoneGroup, after: everyoneGroup })])).toEqual([
      {
        elemID: everyoneGroup.elemID,
        severity: 'Error',
        message: 'Assignment to the "Everyone" group are managed by Okta.',
        detailedMessage:
          'Group assignments to the "Everyone" group are managed by Okta. Any users added in this deployment will be auto assigned to this group.',
      },
    ])
  })
  it('should not return an error when modifying a different group members instance', async () => {
    expect(await everyoneGroupAssignments([toChange({ before: otherGroup, after: otherGroup })])).toEqual([])
  })
})
