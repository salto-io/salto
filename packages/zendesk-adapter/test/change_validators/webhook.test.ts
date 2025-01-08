/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { WEBHOOK_TYPE_NAME, ZENDESK } from '../../src/constants'
import { createChangeError, webhookAuthDataValidator } from '../../src/change_validators/webhook'
import ZendeskClient from '../../src/client/client'

describe('webhookAuthDataValidator', () => {
  const client = new ZendeskClient({ credentials: { username: 'a', password: 'b', subdomain: 'ignore' } })
  const changeValidator = webhookAuthDataValidator(client)

  const webhookType = new ObjectType({
    elemID: new ElemID(ZENDESK, WEBHOOK_TYPE_NAME),
  })
  const webhookInstanceWithBasicAuth = new InstanceElement('test1', webhookType, {
    name: 'test',
    authentication: { type: 'basic_auth' },
  })
  const webhookInstanceWithToken = new InstanceElement('test2', webhookType, {
    name: 'test',
    authentication: { type: 'bearer_token' },
  })
  const webhookInstanceWithoutAuth = new InstanceElement('test3', webhookType, { name: 'test' })
  it('should return an info message if a new webhook is created with auth', async () => {
    const errors = await changeValidator([toChange({ after: webhookInstanceWithBasicAuth })])
    expect(errors).toEqual([createChangeError(webhookInstanceWithBasicAuth.elemID, client.getUrl().href)])
  })
  it('should not return an info message if a new webhook is created without auth', async () => {
    const errors = await changeValidator([toChange({ after: webhookInstanceWithoutAuth })])
    expect(errors).toEqual([])
  })
  it('should not return an info message if webhook was modified but auth remained the same', async () => {
    const clonedBefore = webhookInstanceWithToken.clone()
    const clonedAfter = webhookInstanceWithToken.clone()
    clonedAfter.value.name = 'test - updated'
    const errors = await changeValidator([toChange({ before: clonedBefore, after: clonedAfter })])
    expect(errors).toEqual([])
  })
  it('should return an info message if webhook auth was modified', async () => {
    const clonedBefore = webhookInstanceWithToken.clone()
    const clonedAfter = webhookInstanceWithToken.clone()
    clonedAfter.value.authentication.type = 'basic_auth'
    const errors = await changeValidator([toChange({ before: clonedBefore, after: clonedAfter })])
    expect(errors).toEqual([createChangeError(webhookInstanceWithToken.elemID, client.getUrl().href)])
  })
  it('should not return an error if the webhook was removed', async () => {
    const errors = await changeValidator([toChange({ before: webhookInstanceWithToken })])
    expect(errors).toHaveLength(0)
  })
})
