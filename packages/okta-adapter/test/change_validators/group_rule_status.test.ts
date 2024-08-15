/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { toChange, ObjectType, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { groupRuleStatusValidator } from '../../src/change_validators/group_rule_status'
import { OKTA, GROUP_RULE_TYPE_NAME } from '../../src/constants'

describe('groupRuleStatusValidator', () => {
  const groupRuleType = new ObjectType({ elemID: new ElemID(OKTA, GROUP_RULE_TYPE_NAME) })
  const groupRule1 = new InstanceElement('groupRule1', groupRuleType, {
    name: 'rule',
    status: 'ACTIVE',
    conditions: {},
  })
  const groupRule2 = new InstanceElement('groupRule2', groupRuleType, {
    name: 'rule',
    status: 'ACTIVE',
    conditions: {},
  })
  const groupRule3 = new InstanceElement('groupRule3', groupRuleType, {
    name: 'rule',
    status: 'INVALID',
    conditions: {},
  })

  it('should return an error in case of group rule change in status ACTIVE', async () => {
    const groupRule2After = groupRule2.clone()
    groupRule2After.value.name = 'new name'
    const changeErrors = await groupRuleStatusValidator([
      toChange({ before: groupRule1 }),
      toChange({ before: groupRule2, after: groupRule2After }),
    ])
    expect(changeErrors).toHaveLength(2)
    expect(changeErrors).toEqual([
      {
        elemID: groupRule1.elemID,
        severity: 'Error',
        message: `Cannot remove ${GROUP_RULE_TYPE_NAME} with status ACTIVE`,
        detailedMessage: `Cannot remove ${GROUP_RULE_TYPE_NAME} with status ACTIVE. Please change instance status to INACTIVE and try again.`,
      },
      {
        elemID: groupRule2.elemID,
        severity: 'Error',
        message: `Cannot modify ${GROUP_RULE_TYPE_NAME} with status ACTIVE`,
        detailedMessage: `Cannot modify ${GROUP_RULE_TYPE_NAME} with status ACTIVE. Please change instance status to INACTIVE and try again.`,
      },
    ])
  })
  it('should return an error when trying to change group rule in status INVALID', async () => {
    const changeErrors = await groupRuleStatusValidator([toChange({ before: groupRule3, after: groupRule3 })])
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors).toEqual([
      {
        elemID: groupRule3.elemID,
        severity: 'Error',
        message: `Cannot modify ${GROUP_RULE_TYPE_NAME} with status INVALID`,
        detailedMessage: `Cannot modify ${GROUP_RULE_TYPE_NAME} with status INVALID. You can remove this instance and create a new one.`,
      },
    ])
  })
  it('should not return errors when group rule status changed', async () => {
    const groupRule1After = groupRule1.clone()
    groupRule1After.value.status = 'INACTIVE'
    const groupRule4 = new InstanceElement('groupRule4', groupRuleType, {
      name: 'rule',
      status: 'INACTIVE',
      conditions: {},
    })
    const groupRule4After = groupRule4.clone()
    groupRule4After.value.status = 'ACTIVE'
    const changeErrors = await groupRuleStatusValidator([
      toChange({ before: groupRule1, after: groupRule1After }),
      toChange({ before: groupRule4, after: groupRule4After }),
    ])
    expect(changeErrors).toHaveLength(0)
    expect(changeErrors).toEqual([])
  })
})
