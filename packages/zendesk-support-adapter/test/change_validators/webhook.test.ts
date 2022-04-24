/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { ZENDESK_SUPPORT } from '../../src/constants'
import { createChangeError, webhookAuthDataValidator } from '../../src/change_validators/webhook'
import { WEBHOOK_TYPE_NAME } from '../../src/filters/webhook'

describe('webhookAuthDataValidator', () => {
  const webhookType = new ObjectType({
    elemID: new ElemID(ZENDESK_SUPPORT, WEBHOOK_TYPE_NAME),
  })
  const webhookInstanceWithBasicAuth = new InstanceElement(
    'test1',
    webhookType,
    { name: 'test', authentication: { type: 'basic_auth' } },
  )
  const webhookInstanceWithToken = new InstanceElement(
    'test2',
    webhookType,
    { name: 'test', authentication: { type: 'bearer_token' } },
  )
  const webhookInstanceWithoutAuth = new InstanceElement(
    'test3',
    webhookType,
    { name: 'test' },
  )
  it('should return an info message if a new webhook is created with auth', async () => {
    const errors = await webhookAuthDataValidator(
      [toChange({ after: webhookInstanceWithBasicAuth })],
    )
    expect(errors).toEqual([createChangeError(webhookInstanceWithBasicAuth.elemID)])
  })
  it('should not return an info message if a new webhook is created without auth', async () => {
    const errors = await webhookAuthDataValidator(
      [toChange({ after: webhookInstanceWithoutAuth })],
    )
    expect(errors).toEqual([])
  })
  it('should not return an info message if webhook was modified but auth remained the same', async () => {
    const clonedBefore = webhookInstanceWithToken.clone()
    const clonedAfter = webhookInstanceWithToken.clone()
    clonedAfter.value.name = 'test - updated'
    const errors = await webhookAuthDataValidator(
      [toChange({ before: clonedBefore, after: clonedAfter })],
    )
    expect(errors).toEqual([])
  })
  it('should return an info message if webhook auth was modified', async () => {
    const clonedBefore = webhookInstanceWithToken.clone()
    const clonedAfter = webhookInstanceWithToken.clone()
    clonedAfter.value.authentication.type = 'basic_auth'
    const errors = await webhookAuthDataValidator(
      [toChange({ before: clonedBefore, after: clonedAfter })],
    )
    expect(errors).toEqual([createChangeError(webhookInstanceWithToken.elemID)])
  })
  it('should not return an error if the brand was removed', async () => {
    const errors = await webhookAuthDataValidator(
      [toChange({ before: webhookInstanceWithToken })],
    )
    expect(errors).toHaveLength(0)
  })
})
