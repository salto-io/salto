/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { collections } from '@salto-io/lowerdash'
import {
  ChangeError,
  ChangeValidator,
  getChangeElement,
  InstanceElement,
  isAdditionChange,
  isAdditionOrModificationChange,
  isInstanceChange,
  ModificationChange,
  toChange,
} from '@salto-io/adapter-api'
import { walkOnElement, WALK_STOP_VALUE } from '@salto-io/adapter-utils'
import { removeIdenticalValues } from '../filters/data_instances_diff'
import { isDataObjectType } from '../types'

const { awu } = collections.asynciterable

const hasUnresolvedAccountSpecificValue = async (instance: InstanceElement): Promise<boolean> => {
  let foundAccountSpecificValue = false
  walkOnElement({
    element: instance,
    func: ({ value, path }) => {
      if (path.isAttrID()) {
        return WALK_STOP_VALUE.SKIP
      }
      if ((value.id === '[ACCOUNT_SPECIFIC_VALUE]' && value.internalId === undefined) || value.internalId === '[ACCOUNT_SPECIFIC_VALUE]') {
        foundAccountSpecificValue = true
        return WALK_STOP_VALUE.EXIT
      }
      return WALK_STOP_VALUE.RECURSE
    },
  })
  return foundAccountSpecificValue
}

const changeValidator: ChangeValidator = async changes => (
  awu(changes)
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .filter(async change => isDataObjectType(
      await getChangeElement<InstanceElement>(change).getType()
    ))
    .map(async change => {
      if (isAdditionChange(change)) {
        return change
      }
      const modificationChange = toChange({
        before: change.data.before.clone(),
        after: change.data.after.clone(),
      }) as ModificationChange<InstanceElement>
      await removeIdenticalValues(modificationChange)
      return modificationChange
    })
    .map(change => getChangeElement<InstanceElement>(change))
    .filter(hasUnresolvedAccountSpecificValue)
    .map((instance): ChangeError => ({
      elemID: instance.elemID,
      severity: 'Error',
      message: 'Instance has an ACCOUNT_SPECIFIC_VALUE that Salto cannot resolve',
      detailedMessage: `Instance ${instance.elemID.getFullName()} has an ACCOUNT_SPECIFIC_VALUE that Salto cannot resolve. In order to deploy the instance, please either fill the ACCOUNT_SPECIFIC_VALUE with the real env-specific value or deploy the instance without it`,
    }))
    .toArray()
)

export default changeValidator
