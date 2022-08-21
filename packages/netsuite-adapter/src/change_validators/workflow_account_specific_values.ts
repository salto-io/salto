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
import { values } from '@salto-io/lowerdash'
import {
  ChangeError,
  ChangeValidator,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { walkOnElement, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import { ACCOUNT_SPECIFIC_VALUE, WORKFLOW } from '../constants'

const { isDefined } = values
const SENDER = 'sender'
const RECIPIENT = 'recipient'
const SPECIFIC = 'SPECIFIC'


const changeValidator: ChangeValidator = async changes => (
  changes
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isInstanceElement)
    .filter(inst => inst.elemID.typeName === WORKFLOW)
    .map(instance => {
      let foundError: ChangeError | undefined
      walkOnElement({
        element: instance,
        func: ({ value, path }) => {
          if (path.isAttrID()) {
            return WALK_NEXT_STEP.SKIP
          }
          if ((path.getFullNameParts().slice(-2)[0] === 'sendemailaction')) {
            if ((value.sender === ACCOUNT_SPECIFIC_VALUE && value.sendertype === SPECIFIC)
              || (value?.recipient === ACCOUNT_SPECIFIC_VALUE
                && value?.recipienttype === SPECIFIC)) {
              const probField = value?.sender === ACCOUNT_SPECIFIC_VALUE
              && value?.sendertype === SPECIFIC ? SENDER : RECIPIENT
              foundError = {
                elemID: instance.elemID,
                severity: 'Error',
                message: 'Workflow contains fields which cannot be deployed',
                detailedMessage: `The Workflow contains a '${probField}' field with an ACCOUNT_SPECIFIC_VALUE which cannot be deployed due to NetSuite constraints. Please refer to https://docs.salto.io/docs/netsuite#deploy-troubleshooting for more information.`,
              }
            }
            return WALK_NEXT_STEP.EXIT
          }
          return WALK_NEXT_STEP.RECURSE
        },
      })
      return foundError
    })
    .filter(isDefined)
)

export default changeValidator
