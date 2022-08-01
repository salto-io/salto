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
import { ACCOUNT_SPECIFIC_VALUE, WORKFLOW, RECIPIENTEMAIL, SENDER } from '../constants'

const { isDefined } = values

const changeValidator: ChangeValidator = async changes => (
  changes
    .filter(isAdditionOrModificationChange) // leaves only addition and mod changes
    .map(getChangeData) // get the change data of each type
    .filter(isInstanceElement) // leaves only changed instances
    .filter(inst => inst.elemID.typeName === WORKFLOW) // leave only changes  with typename WORKFLOW
    .map(changeData => {
      const instance = changeData
      let foundError: ChangeError | undefined
      walkOnElement({
        element: instance,
        func: ({ value, path }) => {
          if (value === ACCOUNT_SPECIFIC_VALUE && [RECIPIENTEMAIL, SENDER].includes(path.name)) {
            const detMessage = `Instance (${instance.elemID.getFullName()}) contains sender or recepientemail field with ACCOUNT_SPECIFIC_VALUE and therfore will not be deployed. Please manualy edit the fields with ACCOUNT_SPECIFIC_VALUES and run deploy again.`
            foundError = {
              elemID: instance.elemID,
              severity: 'Error',
              message: 'Element contains sender or  recepientmail fields with account specific values. This element will be skipped in the deployment',
              detailedMessage: detMessage,
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
