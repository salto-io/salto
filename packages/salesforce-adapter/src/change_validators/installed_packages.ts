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
import {
  Change,
  ChangeError,
  ChangeValidator,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isInstanceChange,
  isModificationChange,
} from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash/'
import { isInstanceOfTypeChange, safeApiName } from '../filters/utils'
import { INSTALLED_PACKAGE_METADATA } from '../constants'

const { awu } = collections.asynciterable
const { isDefined } = values

const createInstalledPackageInstanceChangeError = async (
  change: Change<InstanceElement>,
): Promise<ChangeError | undefined> => {
  const instance = getChangeData(change)
  const namespace = await safeApiName(instance)
  if (namespace === undefined) {
    return undefined
  }
  if (isModificationChange(change)) {
    return {
      elemID: instance.elemID,
      severity: 'Error',
      message: 'InstalledPackage instances cannot be modified',
      detailedMessage: `The InstalledPackage instance of namespace ${namespace} cannot be modified. You can learn more about this deployment preview error here: https://help.salto.io/en/articles/8058203-installed-packages-cannot-be-added-deleted-through-salto`,
    }
  }
  if (isAdditionChange(change)) {
    return {
      elemID: instance.elemID,
      severity: 'Error',
      message: 'Cannot install a package using Salto',
      detailedMessage: `Package with namespace ${namespace}  cannot be installed using Salto. Please install the package directly from Salesforce's AppExchange and fetch. You can learn more about this deployment preview error here: https://help.salto.io/en/articles/8058203-installed-packages-cannot-be-added-deleted-through-salto`,
    }
  }
  return {
    elemID: instance.elemID,
    severity: 'Error',
    message: 'Cannot uninstall a package using Salto',
    detailedMessage: `Package with namespace ${namespace}  cannot be uninstalled using Salto. Please uninstall this package directly from Salesforce's AppExchange and fetch. You can learn more about this deployment preview error here: https://help.salto.io/en/articles/8058203-installed-packages-cannot-be-added-deleted-through-salto`,
  }
}

const changeValidator: ChangeValidator = async (changes) =>
  awu(changes)
    .filter(isInstanceChange)
    .filter(isInstanceOfTypeChange(INSTALLED_PACKAGE_METADATA))
    .map(createInstalledPackageInstanceChangeError)
    .filter(isDefined)
    .toArray()

export default changeValidator
