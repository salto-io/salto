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
import { Element, getChangeElement, InstanceElement, isAdditionChange, isModificationChange, isRemovalChange, ChangeError, ChangeValidator, ActionName, isInstanceChange, isFieldChange, isObjectType } from '@salto-io/adapter-api'
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { apiName, isCustomObject, metadataType } from '../transformers/transformer'
import { NAMESPACE_SEPARATOR } from '../constants'
import { INSTANCE_SUFFIXES } from '../types'

const { awu } = collections.asynciterable


export const hasNamespace = async (customElement: Element): Promise<boolean> => {
  const apiNameResult = await apiName(customElement, true)
  if (_.isUndefined(apiNameResult)) {
    return false
  }
  const partialFullName = apiNameResult.split('-')[0]

  const elementSuffix = INSTANCE_SUFFIXES
    .map(suffix => `__${suffix}`)
    .find(suffix => partialFullName.endsWith(suffix))

  const cleanFullName = elementSuffix !== undefined
    ? partialFullName.slice(0, -elementSuffix.length)
    : partialFullName
  return cleanFullName.includes(NAMESPACE_SEPARATOR)
}

export const getNamespace = async (customElement: Element): Promise<string> =>
  (await apiName(customElement, true)).split(NAMESPACE_SEPARATOR)[0]

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

const isInstalledPackageVersionChange = async (
  { before, after }: { before: InstanceElement; after: InstanceElement }
): Promise<boolean> => (
  await metadataType(after) === INSTALLED_PACKAGE_METADATA
  && before.value[PACKAGE_VERSION_FIELD_NAME] !== after.value[PACKAGE_VERSION_FIELD_NAME]
)

const changeValidator: ChangeValidator = async changes => {
  const addRemoveErrors = await awu(changes)
    .filter(change => isAdditionChange(change) || isRemovalChange(change))
    .filter(async change => await isCustomObject(getChangeElement(change)) || isFieldChange(change))
    .filter(change => hasNamespace(getChangeElement(change)))
    .map(change => packageChangeError(change.action, getChangeElement(change)))
    .toArray()

  const removeObjectWithPackageFieldsErrors = awu(changes)
    .filter(isRemovalChange)
    .map(getChangeElement)
    .filter(isObjectType)
    .filter(async obj =>
      !(await hasNamespace(obj))
      && awu(Object.values(obj.fields)).some(hasNamespace))
    .map(obj => packageChangeError(
      'remove',
      obj,
      'Cannot remove type because some of its fields belong to a managed package',
    ))
    .toArray()

  const packageVersionChangeErrors = await awu(changes)
    .filter(isInstanceChange)
    .filter(isModificationChange)
    .filter(change => isInstalledPackageVersionChange(change.data))
    .map(change => packageChangeError(
      change.action,
      getChangeElement(change),
      'Cannot change installed package version',
    ))
    .toArray()

  return [
    ...addRemoveErrors,
    ...await removeObjectWithPackageFieldsErrors,
    ...packageVersionChangeErrors,
  ]
}

export default changeValidator
