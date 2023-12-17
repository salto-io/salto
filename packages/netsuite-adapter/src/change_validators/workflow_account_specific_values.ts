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
import { AdditionChange, ChangeError, ElemID, getChangeData, InstanceElement, isAdditionChange, isAdditionOrModificationChange, isEqualValues, isInstanceChange, ModificationChange, Value } from '@salto-io/adapter-api'
import { walkOnElement, WALK_NEXT_STEP, resolvePath } from '@salto-io/adapter-utils'
import { ACCOUNT_SPECIFIC_VALUE, WORKFLOW } from '../constants'
import { NetsuiteChangeValidator } from './types'

const SEND_EMAIL_ACTION = 'sendemailaction'
const SENDER = 'sender'
const RECIPIENT = 'recipient'
const SPECIFIC = 'SPECIFIC'

const PARAMETER = 'parameter'
const INIT_CONDITION = 'initcondition'

const toValidationError = (instance: InstanceElement, probField: string): ChangeError => ({
  elemID: instance.elemID,
  severity: 'Error',
  message: 'Workflow contains fields which cannot be deployed',
  detailedMessage: `The Workflow contains a '${probField}' field with an ACCOUNT_SPECIFIC_VALUE which cannot be deployed due to NetSuite constraints. Please refer to https://help.salto.io/en/articles/6845061-deploying-workflows-actions-with-account-specific-value for more information.`,
})

const toConditionParametersWarning = (elemID: ElemID): ChangeError => ({
  elemID,
  severity: 'Warning',
  message: 'The condition cannot be applied',
  detailedMessage: 'A condition builder parameter in this section contains an ACCOUNT_SPECIFIC_VALUE which cannot be deployed due to NetSuite constraints.',
})

const getClosestInitConditionElemID = (elemID: ElemID): ElemID | undefined => {
  if (elemID.name === INIT_CONDITION) {
    return elemID
  }
  if (elemID.isTopLevel()) {
    return undefined
  }
  return getClosestInitConditionElemID(elemID.createParentID())
}

const isNestedValueChanged = (
  change: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>,
  nestedElemId: ElemID
): boolean => isAdditionChange(change) || !isEqualValues(
  resolvePath(change.data.after, nestedElemId),
  resolvePath(change.data.before, nestedElemId)
)

const changeValidator: NetsuiteChangeValidator = async changes => (
  changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .flatMap(change => {
      const instance = getChangeData(change)
      if (instance.elemID.typeName !== WORKFLOW) {
        return []
      }

      const sendEmailActionFieldsWithAccountSpecificValues = new Set<string>()
      const conditionsWithAccountSpecificValues = new Set<string>()

      walkOnElement({
        element: instance,
        func: ({ value, path }) => {
          if (path.isAttrID()) {
            return WALK_NEXT_STEP.SKIP
          }
          if (path.createParentID().name === SEND_EMAIL_ACTION) {
            if (value?.[SENDER] === ACCOUNT_SPECIFIC_VALUE && value?.sendertype === SPECIFIC) {
              sendEmailActionFieldsWithAccountSpecificValues.add(SENDER)
            }
            if (value?.[RECIPIENT] === ACCOUNT_SPECIFIC_VALUE && value?.recipienttype === SPECIFIC) {
              sendEmailActionFieldsWithAccountSpecificValues.add(RECIPIENT)
            }
          }
          if (path.name === PARAMETER) {
            const conditionElemId = getClosestInitConditionElemID(path) ?? path
            if (
              !conditionsWithAccountSpecificValues.has(conditionElemId.getFullName())
              && Object.values(value).some((val: Value) => val?.value === ACCOUNT_SPECIFIC_VALUE)
              && isNestedValueChanged(change, conditionElemId)
            ) {
              conditionsWithAccountSpecificValues.add(conditionElemId.getFullName())
            }
          }
          return WALK_NEXT_STEP.RECURSE
        },
      })

      const sendEmailActionErrors = Array.from(sendEmailActionFieldsWithAccountSpecificValues)
        .map(fieldName => toValidationError(instance, fieldName))

      const conditionWarnings = Array.from(conditionsWithAccountSpecificValues)
        .map(ElemID.fromFullName)
        .map(toConditionParametersWarning)

      return sendEmailActionErrors.concat(conditionWarnings)
    })
)

export default changeValidator
