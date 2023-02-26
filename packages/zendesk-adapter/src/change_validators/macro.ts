/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { ChangeValidator, getChangeData,
  isAdditionOrModificationChange, isInstanceElement } from '@salto-io/adapter-api'
import { MACRO_TYPE_NAME } from '../constants'
import { ATTACHMENTS_FIELD_NAME } from '../filters/macro_attachments'

const MAX_ATTACHMENTS_IN_MACRO = 5

export const maxAttachmentsInMacroValidator: ChangeValidator = async changes => (
  changes
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === MACRO_TYPE_NAME)
    .flatMap(instance => {
      if ((instance.value[ATTACHMENTS_FIELD_NAME] ?? []).length > MAX_ATTACHMENTS_IN_MACRO) {
        return [{
          elemID: instance.elemID,
          severity: 'Error',
          message: 'Cannot make this change since there are too many macro attachments',
          detailedMessage: `Cannot have more than ${MAX_ATTACHMENTS_IN_MACRO} attachments in a single macro`,
        }]
      }
      return []
    })
)
