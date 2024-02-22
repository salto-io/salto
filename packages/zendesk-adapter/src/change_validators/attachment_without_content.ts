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
} from '@salto-io/adapter-api'
import { MACRO_ATTACHMENT_TYPE_NAME } from '../filters/macro_attachments'
import { ARTICLE_ATTACHMENT_TYPE_NAME } from '../constants'

const attachmentTypes = [MACRO_ATTACHMENT_TYPE_NAME, ARTICLE_ATTACHMENT_TYPE_NAME]

/**
 * prevent deployment of attachment without content. The attachment can be without content if the get content api call
 * failed
 */
export const attachmentWithoutContentValidator: ChangeValidator = async changes =>
  changes
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isInstanceElement)
    .filter(instance => attachmentTypes.includes(instance.elemID.typeName))
    .filter(instance => instance.value.content === undefined)
    .flatMap(instance => [
      {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Attachment can not be deployed without content',
        detailedMessage: `${instance.elemID.typeName} instance can not be deployed without a content field`,
      },
    ])
