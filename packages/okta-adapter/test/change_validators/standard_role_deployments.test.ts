/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { getChangeData, InstanceElement, ObjectType, ElemID, toChange } from '@salto-io/adapter-api'
import { standardRoleDeployments } from '../../src/change_validators/standard_role_deployments'
import { OKTA, ROLE_TYPE_NAME } from '../../src/constants'

describe('standardRoleDeployments', () => {
  const roleType = new ObjectType({ elemID: new ElemID(OKTA, ROLE_TYPE_NAME) })
  const standardRoleInst = new InstanceElement('role1', roleType, { type: 'APP_ADMIN', label: 'App Admin' })
  const customRoleInst = new InstanceElement('role2', roleType, { label: 'Custom Role' })
  const changes = [
    toChange({ before: standardRoleInst, after: standardRoleInst }),
    toChange({ after: standardRoleInst }),
    toChange({ before: standardRoleInst }),
  ]
  it.each(changes)('should return error for changes in standard roles', async change => {
    expect(await standardRoleDeployments([change])).toEqual([
      {
        elemID: getChangeData(change).elemID,
        severity: 'Error',
        message: 'Standard roles cannot be deployed',
        detailedMessage: 'Okta does not support deployments of standard roles.',
      },
    ])
  })
  it('should not return error for changes in custom roles', async () => {
    const change = toChange({ after: customRoleInst })
    const result = await standardRoleDeployments([change])
    expect(result).toHaveLength(0)
  })
})
