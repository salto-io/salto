/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { definitions as definitionsUtils } from '@salto-io/adapter-components'
import { TARGET_TYPE_NAME, ZENDESK } from '../../src/constants'
import { createAuthenticationChangeError, targetValidator } from '../../src/change_validators/target'
import ZendeskClient from '../../src/client/client'
import { Options } from '../../src/definitions/types'

describe('targetValidator', () => {
  const client = new ZendeskClient({ credentials: { username: 'a', password: 'b', subdomain: 'ignore' } })
  const mockedDefinitions = {
    fetch: {
      instances: {
        default: {},
        customizations: {
          target: {
            element: {
              topLevel: {
                serviceUrl: { path: '/admin/apps-integrations/targets/targets' },
              },
            },
          },
        },
      },
    },
  } as unknown as definitionsUtils.ApiDefinitions<Options>
  const changeValidator = targetValidator(client, mockedDefinitions)

  const targetType = new ObjectType({
    elemID: new ElemID(ZENDESK, TARGET_TYPE_NAME),
  })
  const basicTargetInstance = new InstanceElement('test2', targetType, { type: 'email_target', title: 'test' })
  describe('auth data validation', () => {
    const targetInstanceWithAuth = new InstanceElement('test1', targetType, {
      title: 'test',
      type: 'email_target',
      username: 'test_username',
      password: 'test_password',
    })
    it('should return an info message if a new target is created with auth', async () => {
      const errors = await changeValidator([toChange({ after: targetInstanceWithAuth })])
      expect(errors).toEqual([
        createAuthenticationChangeError(
          targetInstanceWithAuth.elemID,
          targetInstanceWithAuth.value.title,
          client.getUrl().href,
          '/admin/apps-integrations/targets/targets',
        ),
      ])
    })
    it('should not return an info message if a new target is created without auth', async () => {
      const errors = await changeValidator([toChange({ after: basicTargetInstance })])
      expect(errors).toEqual([])
    })
    it('should not return an info message if target was modified but auth remained the same', async () => {
      const clonedBefore = targetInstanceWithAuth.clone()
      const clonedAfter = targetInstanceWithAuth.clone()
      clonedAfter.value.title = 'test - updated'
      const errors = await changeValidator([toChange({ before: clonedBefore, after: clonedAfter })])
      expect(errors).toEqual([])
    })
    it('should return an info message if target username was modified', async () => {
      const clonedBefore = targetInstanceWithAuth.clone()
      const clonedAfter = targetInstanceWithAuth.clone()
      clonedAfter.value.username = 'username - updated'
      const errors = await changeValidator([toChange({ before: clonedBefore, after: clonedAfter })])
      expect(errors).toEqual([
        createAuthenticationChangeError(
          targetInstanceWithAuth.elemID,
          targetInstanceWithAuth.value.title,
          client.getUrl().href,
          '/admin/apps-integrations/targets/targets',
        ),
      ])
    })
    it('should return an info message if target password was modified', async () => {
      const clonedBefore = targetInstanceWithAuth.clone()
      const clonedAfter = targetInstanceWithAuth.clone()
      clonedAfter.value.password = 'password - updated'
      const errors = await changeValidator([toChange({ before: clonedBefore, after: clonedAfter })])
      expect(errors).toEqual([
        createAuthenticationChangeError(
          targetInstanceWithAuth.elemID,
          targetInstanceWithAuth.value.title,
          client.getUrl().href,
          '/admin/apps-integrations/targets/targets',
        ),
      ])
    })

    it('should not return an error if the target was removed', async () => {
      const errors = await changeValidator([toChange({ before: targetInstanceWithAuth })])
      expect(errors).toHaveLength(0)
    })
  })
  describe('target type validation', () => {
    const invalidTargetInstance = basicTargetInstance.clone()
    invalidTargetInstance.value.type = 'invalid_type'

    it('should return an error if the target type is not email_target', async () => {
      const errors = await changeValidator([toChange({ after: invalidTargetInstance })])
      expect(errors).toEqual([
        {
          elemID: invalidTargetInstance.elemID,
          severity: 'Error',
          message: 'Invalid target type detected',
          detailedMessage: `The target ${invalidTargetInstance.value.title} has an invalid type.
Targets besides email target types have been deprecated.
See more here: https://support.zendesk.com/hc/en-us/articles/6468124845210-Announcing-the-deprecation-of-URL-targets-and-branded-targets`,
        },
      ])
    })

    it('should not return an error if the target type is email_target', async () => {
      const errors = await changeValidator([toChange({ after: basicTargetInstance })])
      expect(errors).toEqual([])
    })

    it('should not return an error if the target was removed', async () => {
      const errors = await changeValidator([toChange({ before: invalidTargetInstance })])
      expect(errors).toHaveLength(0)
    })
  })
})
