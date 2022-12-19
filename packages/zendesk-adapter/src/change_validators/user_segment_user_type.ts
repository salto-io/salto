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
import {
  ChangeValidator,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { USER_SEGMENT_TYPE_NAME } from '../constants'

export const VALID_USER_TYPE = ['signed_in_users', 'staff']

/**
 * This change validator checks that the field user_type in user segment is either 'signed_in_users' or 'staff'.
 */
export const userSegmentUserTypeValidator: ChangeValidator = async changes => {
  const relevantInstances = changes
    .filter(isAdditionOrModificationChange)
    .filter(change => getChangeData(change).elemID.typeName === USER_SEGMENT_TYPE_NAME)
    .map(getChangeData)
    .filter(isInstanceElement)
    .filter(instance => !VALID_USER_TYPE.includes(instance.value.user_type))


  return relevantInstances
    .flatMap(instance => [{
      elemID: instance.elemID,
      severity: 'Error',
      message: `Invalid value for user_type in ${instance.elemID.getFullName()}`,
      detailedMessage: `Invalid value for user_type in ${instance.elemID.getFullName()}. The user_type attribute must take one of the following values: ${VALID_USER_TYPE}`,
    }])
}
