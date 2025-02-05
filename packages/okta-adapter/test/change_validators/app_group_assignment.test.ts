/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  toChange,
  ObjectType,
  ElemID,
  InstanceElement,
  ReferenceExpression,
  CORE_ANNOTATIONS,
} from '@salto-io/adapter-api'
import { appGroupAssignmentValidator } from '../../src/change_validators/app_group_assignments'
import { OKTA, APPLICATION_TYPE_NAME, GROUP_TYPE_NAME, APP_GROUP_ASSIGNMENT_TYPE_NAME } from '../../src/constants'

describe('appGroupAssignmentValidator', () => {
  const appType = new ObjectType({ elemID: new ElemID(OKTA, APPLICATION_TYPE_NAME) })
  const groupType = new ObjectType({ elemID: new ElemID(OKTA, GROUP_TYPE_NAME) })
  const appGroupType = new ObjectType({ elemID: new ElemID(OKTA, APP_GROUP_ASSIGNMENT_TYPE_NAME) })
  const groupAInst = new InstanceElement('groupA', groupType, { id: '123', name: 'group' })
  const inactiveApp = new InstanceElement('bookmarkApp', appType, {
    label: 'bookmark app',
    status: 'INACTIVE',
    signOnMode: 'BOOKMARK',
  })
  const appGroupInst = new InstanceElement(
    'appGroup1',
    appGroupType,
    {
      app: new ReferenceExpression(inactiveApp.elemID, inactiveApp),
      group: new ReferenceExpression(groupAInst.elemID, groupAInst),
    },
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(inactiveApp.elemID, inactiveApp)] },
  )

  it('should return an error when adding app group assignment for inactive app', async () => {
    expect(await appGroupAssignmentValidator([toChange({ after: appGroupInst })])).toEqual([
      {
        elemID: appGroupInst.elemID,
        severity: 'Error',
        message: 'Cannot edit group assignments for application in status INACTIVE',
        detailedMessage:
          'Group assignments cannot be changed for applications in status INACTIVE. In order to apply this change, modify application status to be ACTIVE.',
      },
    ])
  })
  it('should return an error when modifying app group assignment for inactive app', async () => {
    expect(await appGroupAssignmentValidator([toChange({ before: appGroupInst, after: appGroupInst })])).toEqual([
      {
        elemID: appGroupInst.elemID,
        severity: 'Error',
        message: 'Cannot edit group assignments for application in status INACTIVE',
        detailedMessage:
          'Group assignments cannot be changed for applications in status INACTIVE. In order to apply this change, modify application status to be ACTIVE.',
      },
    ])
  })
  it('should not return an error when removing app group assignment for inactive app', async () => {
    expect(await appGroupAssignmentValidator([toChange({ before: appGroupInst })])).toEqual([])
  })
  it('should not return error when adding group assignments for active app', async () => {
    const activeApp = new InstanceElement('bookmarkApp', appType, {
      label: 'bookmark app',
      status: 'ACTIVE',
      signOnMode: 'BOOKMARK',
    })
    appGroupInst.annotations[CORE_ANNOTATIONS.PARENT] = [new ReferenceExpression(activeApp.elemID, activeApp)]
    expect(await appGroupAssignmentValidator([toChange({ after: activeApp })])).toEqual([])
  })
  it('should not return error when group assignments for inactive app was not changed', async () => {
    expect(await appGroupAssignmentValidator([toChange({ before: inactiveApp, after: inactiveApp })])).toEqual([])
  })
})
