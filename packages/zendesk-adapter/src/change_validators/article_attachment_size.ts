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
import {
  ChangeValidator,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceElement,
  isStaticFile,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { ARTICLE_ATTACHMENT_TYPE_NAME } from '../constants'

const { awu } = collections.asynciterable
const log = logger(module)

const SIZE_20_MB = 20 * 1024 * 1024
export const articleAttachmentSizeValidator: ChangeValidator = async changes => {
  const invalidAttachments = await awu(changes)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === ARTICLE_ATTACHMENT_TYPE_NAME)
    .filter(async attachmentInstance => {
      const { content } = attachmentInstance.value
      if (content === undefined) {
        log.warn(`the attachment ${attachmentInstance.elemID.getFullName()} does not have a content field`)
        return false
      }
      if (isStaticFile(content) === false) {
        log.warn(`the attachment ${attachmentInstance.elemID.getFullName()} is not a static file`)
        return false
      }
      const contentValue = await attachmentInstance.value.content.getContent()
      if (contentValue === undefined) {
        log.warn(`the attachment ${attachmentInstance.elemID.getFullName()}'s content does not exist`)
        return false
      }
      const internalContentLength = Buffer.byteLength(contentValue)
      return internalContentLength >= SIZE_20_MB
    })
    .toArray()

  return invalidAttachments.flatMap(instance => [
    {
      elemID: instance.elemID,
      severity: 'Error',
      message: `Article attachment ${instance.elemID.name} size has exceeded the file size limit.`,
      detailedMessage: 'The file size limit of article attachments is 20 MB per attachment',
    },
  ])
}
