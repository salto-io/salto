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
import {
  Change, ChangeError, ChangeValidator, getChangeData, isInstanceChange, isModificationChange,
} from '@salto-io/adapter-api'
import { isMetadataInstanceElement } from '../transformers/transformer'
import { apiNameSync } from '../filters/utils'

const { isDefined } = values
const { awu } = collections.asynciterable

const getChangeError = async (change: Change): Promise<ChangeError | undefined> => {
  const changeElem = getChangeData(change)
  if (apiNameSync(changeElem) === undefined) {
    return {
      elemID: changeElem.elemID,
      message: `Cannot ${change.action} element because it has no api name`,
      severity: 'Error',
      detailedMessage: `Cannot ${change.action} ${changeElem.elemID.getFullName()} because it has no api name`,
    }
  }
  if (isModificationChange(change)) {
    const beforeName = apiNameSync(change.data.before)
    const afterName = apiNameSync(change.data.after)
    if (beforeName !== afterName) {
      return {
        elemID: changeElem.elemID,
        message: 'Failed to update element because the API name before the change is different from the API name after it',
        severity: 'Error',
        detailedMessage: `Failed to update element because api names prev=${beforeName} and new=${afterName} are different`,
      }
    }
  }
  if (!isInstanceChange(change) || !await isMetadataInstanceElement(changeElem)) {
    return {
      elemID: changeElem.elemID,
      message: 'Cannot deploy because it is not a metadata instance',
      severity: 'Error',
      detailedMessage: `${apiNameSync(changeElem)} is not a metadata instance`,
    }
  }
  return undefined
}

const createChangeValidator: ChangeValidator = async changes => (
  awu(changes)
    .map(async change => getChangeError(change))
    .filter(isDefined)
    .toArray()
)

export default createChangeValidator
