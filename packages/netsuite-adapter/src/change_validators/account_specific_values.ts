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
import { values, collections } from '@salto-io/lowerdash'
import { ChangeError, Element, getChangeData, isAdditionOrModificationChange } from '@salto-io/adapter-api'
import { isStandardInstanceOrCustomRecordType } from '../types'
import { ACCOUNT_SPECIFIC_VALUE, WORKFLOW } from '../constants'
import { isElementContainsStringValue } from './utils'
import { NetsuiteChangeValidator } from './types'

const { awu } = collections.asynciterable
const { isDefined } = values

export const toAccountSpecificValuesWarning = (element: Element): ChangeError => ({
  elemID: element.elemID,
  severity: 'Warning',
  message: 'Values containing ACCOUNT_SPECIFIC_VALUE are ignored by NetSuite',
  detailedMessage:
    'This element contains values with ACCOUNT_SPECIFIC_VALUE.\n' +
    'These values are ignored by NetSuite and therefore will be skipped from the deployment.\n' +
    'You can either edit the element in Salto and replace ACCOUNT_SPECIFIC_VALUE with the real value and deploy it or after a successful deploy, set the correct value directly in the NetSuite UI.',
})

const changeValidator: NetsuiteChangeValidator = async changes =>
  awu(changes)
    .filter(isAdditionOrModificationChange)
    .map(async change => {
      const element = getChangeData(change)
      if (!isStandardInstanceOrCustomRecordType(element)) {
        return undefined
      }
      // workflow account specific values are handled in another CV
      if (element.elemID.typeName === WORKFLOW) {
        return undefined
      }
      if (!isElementContainsStringValue(element, ACCOUNT_SPECIFIC_VALUE)) {
        return undefined
      }
      return toAccountSpecificValuesWarning(element)
    })
    .filter(isDefined)
    .toArray()

export default changeValidator
