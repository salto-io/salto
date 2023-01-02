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
import { EVERYONE_USER_TYPE, USER_SEGMENT_TYPE_NAME, ZENDESK } from '../constants'

export const everyoneUserSegmentModificationValidator: ChangeValidator = async changes => {
  const everyoneUserSegmentElemID = new ElemID(ZENDESK, USER_SEGMENT_TYPE_NAME, 'instance', EVERYONE_USER_TYPE)
  return changes
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.isEqual(everyoneUserSegmentElemID))
    .flatMap(instance => (
      [{
        elemID: instance.elemID,
        severity: 'Error',
        message: 'The "Everyone" user segment cannot be modified',
        detailedMessage: 'The "Everyone" user segment cannot be modified',
      }]
    ))
}
