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
  ChangeError,
  ChangeValidator,
  getChangeData,
  isInstanceChange,
  isModificationChange,
} from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import { DYNAMIC_CONTENT_ITEM_TYPE_NAME } from '../constants'

const { isDefined } = values

/**
 * Validate that dynamic content item placeholders are not modified
 */
export const dynamicContentPlaceholderModificationValidator: ChangeValidator = async changes => {
  const dynamicContentItemChanges = changes.filter(isInstanceChange).filter(isModificationChange)
    .filter(change => getChangeData(change).elemID.typeName === DYNAMIC_CONTENT_ITEM_TYPE_NAME)

  return dynamicContentItemChanges.map((change): ChangeError | undefined => {
    const { before, after } = change.data
    if (before.value.placeholder !== after.value.placeholder) {
      return {
        elemID: change.data.after.elemID,
        severity: 'Error',
        message: 'Dynamic content item placeholder cannot be modified',
        detailedMessage: 'Dynamic content item placeholder cannot be modified',
      }
    }
    return undefined
  }).filter(isDefined)
}
