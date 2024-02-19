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
  InstanceElement,
  isInstanceChange,
  isRemovalChange,
} from '@salto-io/adapter-api'
import { AUTOMATION_TYPE_NAME } from '../constants'

// Currently we don't have a way of knowing if the environment is production or not (SALTO-4375)
// So we will just warn the user about the deletion, and he will have to decide if he wants to continue
const defaultAutomationRemovalError = (automation: InstanceElement): ChangeError => ({
  elemID: automation.elemID,
  severity: 'Warning',
  message: 'Cannot delete a default automation',
  detailedMessage:
    'The automation is a default automation in Zendesk, and cannot be removed on a production environment',
})
/**
 * Warns the user if he is trying to remove a default automation, as it cannot be removed on a production environment
 */
export const defaultAutomationRemovalValidator: ChangeValidator = async changes => {
  const defaultAutomationRemoval = changes
    .filter(isInstanceChange)
    .filter(isRemovalChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === AUTOMATION_TYPE_NAME)
    .filter(automation => automation.value.default === true)

  return defaultAutomationRemoval.map(defaultAutomationRemovalError)
}
