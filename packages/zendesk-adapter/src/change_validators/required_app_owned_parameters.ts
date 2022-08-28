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
import _ from 'lodash'
import {
  ChangeValidator,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceElement,
  InstanceElement,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { APP_INSTALLATION_TYPE_NAME } from '../filters/app'
import { APP_OWNED_TYPE_NAME } from '../constants'


const { awu } = collections.asynciterable

// returns a list of all required parameters which are not populated
const unpopulatedParameters = (
  appInstallation: InstanceElement, appOwnedInstances: Record<number, InstanceElement>
) : string[] => {
  const appOwned = appOwnedInstances[appInstallation.value.app_id]
  if (appOwned?.value.parameters === undefined) {
    return []
  }
  const { parameters } = appOwned.value
  const requiredParameters = Object.keys(_.pickBy(parameters, val => val.required))
  const appInstallationSettings = new Set(Object.keys(appInstallation.value.settings ?? {}))
  return requiredParameters
    .filter(key => !appInstallationSettings.has(key))
}

// const invalidAppInstallation = (
//   appInstallation: InstanceElement, appOwnedInstances: Record<number, InstanceElement>
// ): boolean => {
//   const appOwned = appOwnedInstances[appInstallation.value.app_id]
//   if (appOwned?.value.parameters === undefined) {
//     return false
//   }
//   const { parameters } = appOwned.value
//   const requiredParameters = Object.keys(_.pickBy(parameters, val => val.required))
//   const appInstallationSettings = new Set(Object.keys(appInstallation.value.settings ?? {}))
//   // check if not all requirements in settings
//   return !requiredParameters
//     .every(key => appInstallationSettings.has(key))
// }

/**
 * This change validator checks if all the required parameters for each app owned are populated in
 * the corresponding app installation. It raises an error for app installation that don't have the
 * required parameters in their setting.
 */
export const requiredAppOwnedParametersValidator: ChangeValidator = async (
  changes, elementSource
) => {
  const appInstallationInstances = changes
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === APP_INSTALLATION_TYPE_NAME)
  if (_.isEmpty(appInstallationInstances) || (elementSource === undefined)) {
    return []
  }

  const appOwnedInstances = await awu(await elementSource.list())
    .filter(id => id.typeName === APP_OWNED_TYPE_NAME)
    .filter(id => id.idType === 'instance')
    .map(id => elementSource.get(id))
    .toArray()

  const recordAppOwnedInstances:
      Record<number, InstanceElement> = _.keyBy(appOwnedInstances, 'value.id')

  return appInstallationInstances
    .filter(appInstallation =>
      !_.isEmpty(unpopulatedParameters(appInstallation, recordAppOwnedInstances)))
    .flatMap(instance => [{
      elemID: instance.elemID,
      severity: 'Error',
      message: 'Can not change app installation, because not all parameters that are defined as required are populated',
      detailedMessage: `Can not change app installation ${instance.elemID.getFullName()},
      because the parameters: ${unpopulatedParameters(instance, recordAppOwnedInstances)}, 
      are required but not populated.`,
    }])
}
