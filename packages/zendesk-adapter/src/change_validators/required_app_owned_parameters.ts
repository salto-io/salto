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
import {
  ChangeValidator,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceElement,
  InstanceElement,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { APP_INSTALLATION_TYPE_NAME } from '../filters/app'
import { APP_OWNED_TYPE_NAME } from '../constants'


const { awu } = collections.asynciterable

const invalidAppInstallation = (
  appInstallation: InstanceElement, appOwnedInstances: InstanceElement[]
): boolean => {
  const appOwned = appOwnedInstances
    .find(appOwnedInstance => appOwnedInstance.value.id === appInstallation.value.app_id)
  if (appOwned?.value.parameters === undefined) {
    return false
  }
  const { parameters } = appOwned.value
  const settings = appInstallation.value.settings ?? {}
  const requiredParameters = Object.keys(_.pickBy(parameters, val => val.required))
  const appInstallationSettings = Object.keys(settings)
  // check if not all requirements in settings
  return !requiredParameters
    .every(key => appInstallationSettings.includes(key))
}

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
    .filter(isInstanceElement)
    .toArray()

  return appInstallationInstances
    .filter(appInstallation => invalidAppInstallation(appInstallation, appOwnedInstances))
    .flatMap(instance => [{
      elemID: instance.elemID,
      severity: 'Error',
      message: 'Can not change app installation ,because not all parameters that are defined as required are populated',
      detailedMessage: `Can not change app installation ${instance.elemID.getFullName()},
      because not all parameters that are defined as required are populated.`,
    }])
}
