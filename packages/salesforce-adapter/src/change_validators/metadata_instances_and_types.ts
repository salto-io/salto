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
  ChangeValidator,
  getChangeData,
  Element,
  ChangeError,
  isModificationChange, isInstanceElement,
} from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import { apiNameSync, isCustomObjectSync, isInstanceOfCustomObjectSync } from '../filters/utils'

const { isDefined } = values

const createElementWithNoApiNameError = ({ elemID }: Element): ChangeError => ({
  message: 'Element has no API name',
  detailedMessage: `The Element ${elemID.getFullName()} has no API name`,
  elemID,
  severity: 'Error',
})

const createApiNameModificationError = ({ elemID }: Element, beforeName: string, afterName: string): ChangeError => ({
  message: 'Cannot modify Element API name',
  detailedMessage: `Attempt to modify the API name of Element ${elemID.getFullName()} from ${beforeName} to ${afterName}`,
  elemID,
  severity: 'Error',
})

const createInvalidElementError = ({ elemID }: Element): ChangeError => ({
  message: 'Element is invalid',
  detailedMessage: `The element ${elemID.getFullName()} is neither a Metadata Instance or a Custom Object`,
  elemID,
  severity: 'Error',
})


const changeValidator: ChangeValidator = async changes => (
  changes
  // The validations are only relevant for Metadata deploy
    .filter(change => !isInstanceOfCustomObjectSync(getChangeData(change)))
    .map(change => {
      const element = getChangeData(change)
      if (apiNameSync(element) === undefined) {
        return createElementWithNoApiNameError(element)
      }
      if (isModificationChange(change)) {
        const beforeName = apiNameSync(change.data.before) ?? ''
        const afterName = apiNameSync(change.data.after) ?? ''
        if (beforeName !== afterName) {
          return createApiNameModificationError(element, beforeName, afterName)
        }
      }
      if (!isInstanceElement(element) && !isCustomObjectSync(element)) {
        return createInvalidElementError(element)
      }
      return undefined
    })
    .filter(isDefined)
)

export default changeValidator
