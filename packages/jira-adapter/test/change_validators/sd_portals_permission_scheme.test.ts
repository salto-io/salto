/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { ObjectType, ElemID, InstanceElement, toChange } from '@salto-io/adapter-api'
import {
  permissionSchemeValidator,
  UNSUPPORTED_PERMISSION_SCHEME,
} from '../../src/change_validators/sd_portals_permission_scheme'
import { JIRA, PERMISSION_SCHEME_TYPE_NAME } from '../../src/constants'

describe('permissionSchemeChangeValidator', () => {
  let permissionSchemeType: ObjectType
  let permissionSchemeInstance: InstanceElement

  beforeEach(() => {
    permissionSchemeType = new ObjectType({ elemID: new ElemID(JIRA, PERMISSION_SCHEME_TYPE_NAME) })

    permissionSchemeInstance = new InstanceElement('instance', permissionSchemeType, {
      description: 'description',
      permissions: [],
    })
  })

  it('should return a warning when attempting to deploy this permissionScheme', async () => {
    permissionSchemeInstance.value.permissions = [UNSUPPORTED_PERMISSION_SCHEME]

    expect(await permissionSchemeValidator([toChange({ after: permissionSchemeInstance })])).toEqual([
      {
        elemID: permissionSchemeInstance.elemID,
        severity: 'Warning',
        message: 'Cannot deploy the permission scheme permission',
        detailedMessage: `Jira does not allow granting the permission 'VIEW_AGGREGATED_DATA' to 'sd.customer.portal.only'. The permission scheme ${permissionSchemeInstance.elemID.getFullName()} will be deployed without it`,
      },
    ])
  })

  it('should not return a warning', async () => {
    expect(await permissionSchemeValidator([toChange({ after: permissionSchemeInstance })])).toEqual([])
  })
})
