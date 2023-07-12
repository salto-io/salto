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
import {
  ChangeError, ChangeValidator, getChangeData, InstanceElement,
  isInstanceChange, isRemovalChange,
} from '@salto-io/adapter-api'
import { AUTOMATION_TYPE_NAME } from '../constants'

const defaultAutomationRemovalError = (automation: InstanceElement): ChangeError => ({
  elemID: automation.elemID,
  severity: 'Error',
  message: 'Cannot delete a default automation',
  detailedMessage: `The automation '${automation.elemID.name}' is a default automation in Zendesk, and cannot be removed`,
})

export const defaultAutomationRemovalValidator: ChangeValidator = async changes => {
  const automationChanges = changes.filter(isInstanceChange)
    .filter(change => getChangeData(change).elemID.typeName === AUTOMATION_TYPE_NAME)

  const defaultAutomationRemoval = automationChanges.filter(isRemovalChange).map(getChangeData)
    .filter(automation => automation.value.default === true)

  return defaultAutomationRemoval.map(defaultAutomationRemovalError)
}
