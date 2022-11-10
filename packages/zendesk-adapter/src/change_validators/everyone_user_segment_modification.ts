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
import { ChangeValidator, ElemID, getChangeData, isInstanceChange } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { EVERYONE } from '../filters/everyone_user_segment'
import { USER_SEGMENT_TYPE_NAME, ZENDESK } from '../constants'

const log = logger(module)

export const everyoneUserSegmentModificationValidator: ChangeValidator = async (
  changes,
  elementSource,
) => {
  if (elementSource === undefined) {
    log.error('Failed to run customRoleNameValidator because no element source was provided')
    return []
  }
  const everyoneUserSegmentElemID = new ElemID(ZENDESK, USER_SEGMENT_TYPE_NAME, 'instance', EVERYONE)
  const everyoneUserSegmentInstance = await elementSource.get(everyoneUserSegmentElemID)
  return changes
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.isEqual(everyoneUserSegmentInstance.elemID))
    .flatMap(instance => (
      [{
        elemID: instance.elemID,
        severity: 'Error',
        message: 'The "Everyone" user segment cannot be modified',
        detailedMessage: 'The "Everyone" user segment cannot be modified',
      }]
    ))
}
