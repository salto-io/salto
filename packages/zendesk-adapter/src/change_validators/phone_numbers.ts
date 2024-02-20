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
import _ from 'lodash'
import {
  ChangeValidator,
  getChangeData,
  isInstanceChange,
  Values,
  ModificationChange,
  AdditionChange,
  isModificationChange,
  InstanceElement,
  isAdditionOrModificationChange,
} from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'

const RELEVANT_TYPES = ['trigger', 'automation']
const PHONE_ACTION_TYPES = ['notification_sms_group', 'notification_sms_user']

const isPhoneIdAction = (action: Values): boolean =>
  _.isPlainObject(action) && PHONE_ACTION_TYPES.includes(action.field)

const getActions = (instance: InstanceElement): Values[] => instance.value.actions ?? []

const getPhoneIds = (instance: InstanceElement): string[] =>
  getActions(instance)
    .filter(isPhoneIdAction)
    // value[1] is the phone id
    .map(v => v.value[1])
    .filter(values.isDefined)

const isChangeOfPhoneId = (change: ModificationChange<InstanceElement> | AdditionChange<InstanceElement>): boolean => {
  const beforePhoneIds = isModificationChange(change) ? new Set(getPhoneIds(change.data.before)) : new Set()
  const afterPhoneIds = getPhoneIds(getChangeData(change))
  return afterPhoneIds.filter(id => !beforePhoneIds.has(id)).length > 0
}

export const phoneNumbersValidator: ChangeValidator = async changes =>
  changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .filter(change => RELEVANT_TYPES.includes(getChangeData(change).elemID.typeName))
    .filter(change => isChangeOfPhoneId(change))
    .map(getChangeData)
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Error',
      message: 'Adding / modifying phone number ids is not supported.',
      detailedMessage: `Element ${instance.elemID.getFullName()} includes additions / modifications of phone number ids and therefore cannot be deployed from Salto. Please make any phone number changes via the Zendesk UI and fetch.`,
    }))
