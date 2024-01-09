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
import { ChangeValidator, getChangeData, isInstanceChange, SeverityLevel, isAdditionChange } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { PROJECT_TYPE, SERVICE_DESK } from '../constants'
import { hasJiraServiceDeskLicense } from '../utils'

const { awu } = collections.asynciterable

/*
* This validator prevents addition of jsm project when JSM is disabled in the service.
*/
export const addJsmProjectValidator: ChangeValidator = async (changes, elementsSource) => {
  if (elementsSource === undefined) {
    return []
  }
  if (await hasJiraServiceDeskLicense(elementsSource) === true) {
    return []
  }

  return awu(changes)
    .filter(isInstanceChange)
    .filter(isAdditionChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === PROJECT_TYPE)
    .filter(project => project.value.projectTypeKey === SERVICE_DESK)
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Error' as SeverityLevel,
      message: 'Cannot add this project because JSM is disabled in the service.',
      detailedMessage: 'Please enable JSM through the service in order to add this element',
    }))
    .toArray()
}
