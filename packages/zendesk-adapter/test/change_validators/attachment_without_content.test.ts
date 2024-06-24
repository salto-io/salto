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
import { ZENDESK } from '../../src/constants'
import { MACRO_ATTACHMENT_TYPE_NAME } from '../../src/filters/macro_attachments'
import { attachmentWithoutContentValidator } from '../../src/change_validators'

describe('attachmentWithoutContentValidator', () => {
  const attachmentInstance = new InstanceElement(
    'testAttachment',
    new ObjectType({ elemID: new ElemID(ZENDESK, MACRO_ATTACHMENT_TYPE_NAME) }),
    {},
  )
  it('should return an error if attachment is without content', async () => {
    const errors = await attachmentWithoutContentValidator([toChange({ after: attachmentInstance })])
    expect(errors).toEqual([
      {
        elemID: attachmentInstance.elemID,
        severity: 'Error',
        message: 'Attachment can not be deployed without content',
        detailedMessage: `${attachmentInstance.elemID.typeName} instance can not be deployed without a content field`,
      },
    ])
  })
  it('should not return an error if there is a content field', async () => {
    const clonedAttachment = attachmentInstance.clone()
    clonedAttachment.value.content = 'something'
    const errors = await attachmentWithoutContentValidator([toChange({ after: clonedAttachment })])
    expect(errors).toHaveLength(0)
  })
})
