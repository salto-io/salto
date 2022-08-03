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
import { ACCOUNT_SPECIFIC_VALUE, WORKFLOW, RECIPIENTEMAIL, SENDER, SENDERTYPE, RECIPIENTTYPE, SENDERFIELD, RECIPIENTFIELD } from '../constants'

const { isDefined } = values

const changeValidator: ChangeValidator = async changes => (
  changes
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isInstanceElement)
    .filter(inst => inst.elemID.typeName === WORKFLOW)
    .map(changeData => {
      const instance = changeData
      let foundError: ChangeError | undefined
      walkOnElement({
        element: instance,
        func: ({ value, path }) => {
          if (path.isAttrID()) {
            return WALK_NEXT_STEP.SKIP
          }
          if (value === ACCOUNT_SPECIFIC_VALUE && [RECIPIENTEMAIL, SENDER].includes(path.name)) {
            const probField = [SENDER].includes(path.name) ? SENDER : RECIPIENTEMAIL
            const toFixField = probField === SENDER ? SENDERFIELD : RECIPIENTFIELD
            const toFixType = probField === SENDER ? SENDERTYPE : RECIPIENTTYPE
            foundError = {
              elemID: instance.elemID,
              severity: 'Error',
              message: `Element contains '${SENDER}' or '${RECIPIENTEMAIL}' fields with ${ACCOUNT_SPECIFIC_VALUE}. Please set your specific desired values within NetSuite before deploying.`,
              detailedMessage: `The Workflow contains a '${probField}' field with an ${ACCOUNT_SPECIFIC_VALUE} which cannot be deployed due to NetSuite constraints. 
              In order to continue with this deployment, please set '${toFixType}' value to 'FIELD' and '${toFixField}' to 'STDUSERUSER'. 
              After the deployment is done, please set your desired values within the NetSuite UI in the target account and then fetch it.`,
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
