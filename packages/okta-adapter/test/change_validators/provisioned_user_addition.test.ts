/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { toChange, ObjectType, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { OKTA, USER_TYPE_NAME } from '../../src/constants'
import { provisionedUserAdditions } from '../../src/change_validators/provisioned_user_addition'

describe('provisionedUserAdditions', () => {
  const userType = new ObjectType({ elemID: new ElemID(OKTA, USER_TYPE_NAME) })

  describe('addition changes', () => {
    it('should create change error with level Info when user is created with PROVISIONED status', async () => {
      const instance = new InstanceElement('user1', userType, { status: 'PROVISIONED' })
      const change = toChange({ after: instance })
      const result = await provisionedUserAdditions([change])
      expect(result).toHaveLength(1)
      expect(result).toMatchObject([{
        elemID: instance.elemID,
        severity: 'Info',
        message: 'User will be emailed to complete the activation process',
        detailedMessage:
          'Salto does not configure authentication for newly added users. The user will receive an email with instructions to complete the activation process.',
      }])
    })

    it('should not create change errors for users with STAGED status', async () => {
      const instance = new InstanceElement('user2', userType, { status: 'STAGED' })
      const change = toChange({ after: instance })
      const result = await provisionedUserAdditions([change])
      expect(result).toMatchObject([])
    })
  })

  describe('removal or modification changes', () => {
    it('should not create change errors for removed or modified users with PROVISIONED status', async () => {
      const instanceBefore = new InstanceElement('user3', userType, { status: 'STAGED' })
      const instanceAfter = new InstanceElement('user3', userType, { status: 'PROVISIONED' })
      const result = await provisionedUserAdditions([
        toChange({ before: instanceBefore, after: instanceAfter }),
        toChange({ before: instanceAfter }),
      ])
      expect(result).toMatchObject([])
    })
  })
})
