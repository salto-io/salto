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
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import { TARGET_TYPE_NAME, ZENDESK } from '../../src/constants'
import { createChangeError, targetAuthDataValidator } from '../../src/change_validators/target'
import ZendeskClient from '../../src/client/client'
import { API_DEFINITIONS_CONFIG, DEFAULT_CONFIG } from '../../src/config'

describe('targetAuthDataValidator', () => {
  const client = new ZendeskClient({ credentials: { username: 'a', password: 'b', subdomain: 'ignore' } })
  const config = _.cloneDeep(DEFAULT_CONFIG[API_DEFINITIONS_CONFIG])
  const changeValidator = targetAuthDataValidator(client, config)

  const targetType = new ObjectType({
    elemID: new ElemID(ZENDESK, TARGET_TYPE_NAME),
  })
  const targetInstanceWithAuth = new InstanceElement('test1', targetType, {
    title: 'test',
    username: 'test_username',
    password: 'test_password',
  })
  const targetInstanceWithoutAuth = new InstanceElement('test2', targetType, { title: 'test' })
  it('should return an info message if a new target is created with auth', async () => {
    const errors = await changeValidator([toChange({ after: targetInstanceWithAuth })])
    expect(errors).toEqual([
      createChangeError(
        targetInstanceWithAuth.elemID,
        targetInstanceWithAuth.value.title,
        client.getUrl().href,
        config.types.target.transformation?.serviceUrl,
      ),
    ])
  })
  it('should not return an info message if a new target is created without auth', async () => {
    const errors = await changeValidator([toChange({ after: targetInstanceWithoutAuth })])
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
      createChangeError(
        targetInstanceWithAuth.elemID,
        targetInstanceWithAuth.value.title,
        client.getUrl().href,
        config.types.target.transformation?.serviceUrl,
      ),
    ])
  })
  it('should return an info message if target password was modified', async () => {
    const clonedBefore = targetInstanceWithAuth.clone()
    const clonedAfter = targetInstanceWithAuth.clone()
    clonedAfter.value.password = 'password - updated'
    const errors = await changeValidator([toChange({ before: clonedBefore, after: clonedAfter })])
    expect(errors).toEqual([
      createChangeError(
        targetInstanceWithAuth.elemID,
        targetInstanceWithAuth.value.title,
        client.getUrl().href,
        config.types.target.transformation?.serviceUrl,
      ),
    ])
  })
  it('should not return an error if the target was removed', async () => {
    const errors = await changeValidator([toChange({ before: targetInstanceWithAuth })])
    expect(errors).toHaveLength(0)
  })
})
