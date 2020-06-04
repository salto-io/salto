/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { Element, getChangeElement, InstanceElement, isAdditionDiff, isModificationDiff, isObjectType, isRemovalDiff, ChangeError, ChangeValidator, ActionName, isInstanceChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import { apiName, isCustom, metadataType } from '../transformers/transformer'
import { NAMESPACE_SEPARATOR } from '../constants'


export const hasNamespace = (customElement: Element): boolean => {
  const apiNameResult = apiName(customElement, true)
  if (_.isUndefined(apiNameResult)) {
    return false
  }
  const partialFullName = apiNameResult.split('-')[0]
  const cleanFullName = isCustom(partialFullName)
    ? partialFullName.slice(0, -3) : partialFullName
  return cleanFullName.includes(NAMESPACE_SEPARATOR)
}

export const getNamespace = (customElement: Element): string =>
  apiName(customElement, true).split(NAMESPACE_SEPARATOR)[0]

export const PACKAGE_VERSION_FIELD_NAME = 'version_number'
export const INSTALLED_PACKAGE_METADATA = 'InstalledPackage'

const packageChangeError = (
  action: ActionName,
  element: Element,
  detailedMessage = `Cannot ${action} ${element.elemID.idType} because it is part of a package`,
): ChangeError => ({
  elemID: element.elemID,
  severity: 'Error',
  message: `Cannot change a managed package using Salto. Package namespace: ${getNamespace(element)}`,
  detailedMessage,
})

const isInstalledPackageVersionChange = (
  { before, after }: { before: InstanceElement; after: InstanceElement }
): boolean => (
  metadataType(after) === INSTALLED_PACKAGE_METADATA
  && before.value[PACKAGE_VERSION_FIELD_NAME] !== after.value[PACKAGE_VERSION_FIELD_NAME]
)

const changeValidator: ChangeValidator = async changes => {
  const addRemoveErrors = changes.changes
    .filter(change => isAdditionDiff(change) || isRemovalDiff(change))
    .filter(change => hasNamespace(getChangeElement(change)))
    .map(change => packageChangeError(change.action, getChangeElement(change)))

  const removeObjectWithPackageFieldsErrors = changes.changes
    .filter(isRemovalDiff)
    .map(getChangeElement)
    .filter(isObjectType)
    .filter(obj => !hasNamespace(obj) && _.some(Object.values(obj.fields).map(hasNamespace)))
    .map(obj => packageChangeError(
      'remove',
      obj,
      'Cannot remove type because some of its fields belong to a managed package',
    ))

  const packageVersionChangeErrors = changes.changes
    .filter(isInstanceChange)
    .filter(isModificationDiff)
    .filter(change => isInstalledPackageVersionChange(change.data))
    .map(change => packageChangeError(
      change.action,
      getChangeElement(change),
      'Cannot change installed package version',
    ))

  return [
    ...addRemoveErrors,
    ...removeObjectWithPackageFieldsErrors,
    ...packageVersionChangeErrors,
  ]
}

export default changeValidator
