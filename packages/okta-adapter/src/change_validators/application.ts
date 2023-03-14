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
import { ChangeValidator, getChangeData, isInstanceChange, isRemovalChange, InstanceElement, ChangeError } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { ACTIVE_STATUS, APPLICATION_TYPE_NAME } from '../constants'

const { awu } = collections.asynciterable

/**
 * Removal of Application in status 'ACTIVE' is not supported by the service
 */
export const applicationValidator: ChangeValidator = async changes => (
  awu(changes)
    .filter(isInstanceChange)
    .filter(isRemovalChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === APPLICATION_TYPE_NAME)
    .filter(instance => instance.value.status === ACTIVE_STATUS)
    .map((instance: InstanceElement): ChangeError => ({
      elemID: instance.elemID,
      severity: 'Error',
      message: 'Cannot remove an active application',
      detailedMessage: `Cannot remove an active application: ${instance.elemID.getFullName()} must be deactivated before removal`,
    }))
    .toArray()
)
