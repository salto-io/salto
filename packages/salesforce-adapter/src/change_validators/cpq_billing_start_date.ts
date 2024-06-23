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
  InstanceElement,
  isAdditionOrModificationChange,
  getChangeData,
} from '@salto-io/adapter-api'
import { apiNameSync, isInstanceOfTypeChangeSync } from '../filters/utils'

const CPQ_BILLING_START_DATE_TIME = 'blng__StartDateTime__c'

const TYPES_WITH_START_DATES = [
  'blng__InvoiceScheduler__c',
  'blng__BalanceSnapShotScheduler__c',
  'blng__Usage__c',
]

const isStartDateInPast = (instance: InstanceElement): boolean =>
  // Note: the field value contains a timezone (e.g. '2024-06-13T16:00:00.000+0000'), so the comparison should work
  //       correctly even if we're running in a different timezone from the one we're deploying to.
  instance.value[CPQ_BILLING_START_DATE_TIME] !== undefined &&
  new Date(instance.value[CPQ_BILLING_START_DATE_TIME]) <= new Date()

const createAdditionError = (instance: InstanceElement): ChangeError => ({
  elemID: instance.elemID,
  severity: 'Error',
  message: `Unable to deploy records of type ${apiNameSync(instance.getTypeSync())} with a 'StartDateTime' in the past`,
  detailedMessage:
    "The value of the 'StartDateTime' field of this record is in the past. " +
    "Salesforce does not allow deploying records with a 'StartDateTime' value in the past. " +
    "To deploy this records, manually edit it so that the 'StartDateTime' value is later than the time you intend to deploy it.",
})

const changeValidator: ChangeValidator = async (changes) =>
  changes
    .filter(isInstanceOfTypeChangeSync(...TYPES_WITH_START_DATES))
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isStartDateInPast)
    .map(createAdditionError)

export default changeValidator
