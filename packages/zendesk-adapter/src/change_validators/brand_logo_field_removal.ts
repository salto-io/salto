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
import { ChangeValidator, getChangeData, InstanceElement, isInstanceChange,
  isModificationChange, isRemovalChange, ModificationChange } from '@salto-io/adapter-api'
import { BRAND_LOGO_TYPE_NAME, BRAND_NAME } from '../constants'

const isLogoRemoved = (
  change: ModificationChange<InstanceElement>
): boolean => (
  change.data.before.value.logo !== undefined
  && change.data.after.value.logo === undefined
)

export const brandLogoFieldRemovalValidator: ChangeValidator = async changes => {
  const removedBrandLogosElemIds = new Set(changes
    .filter(change => getChangeData(change).elemID.typeName === BRAND_LOGO_TYPE_NAME)
    .filter(isRemovalChange)
    .filter(isInstanceChange)
    .map(change => change.data.before.elemID.getFullName()))

  return changes
    .filter(change => getChangeData(change).elemID.typeName === BRAND_NAME)
    .filter(isInstanceChange)
    .filter(isModificationChange)
    .filter(isLogoRemoved)
    .filter(change => !removedBrandLogosElemIds.has(
      change.data.before.value.logo.elemID.getFullName()
    ))
    .map(getChangeData)
    .flatMap(instance => (
      [{
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Cannot remove brand logo because it is still in use',
        detailedMessage: `Cannot remove brand logo ${instance.value.name} because it is still in use by instance ${instance.elemID.getFullName()}. If you want to delete the brand logo, please remove the instance as well`,
      }]
    ))
}
