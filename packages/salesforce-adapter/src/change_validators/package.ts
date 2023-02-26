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
  ActionName,
  Change,
  ChangeError,
  ChangeValidator,
  Element,
  getAllChangeData,
  getChangeData,
  InstanceElement,
  isAdditionOrRemovalChange,
  isFieldChange,
  isInstanceChange,
  isModificationChange,
  isObjectType,
  isRemovalChange,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { detailedCompare } from '@salto-io/adapter-utils'
import { apiName, isCustomObject, metadataType } from '../transformers/transformer'
import { INSTALLED_PACKAGE_METADATA, NAMESPACE_SEPARATOR } from '../constants'
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

const packageChangeError = async (
  action: ActionName,
  element: Element,
  detailedMessage?: string,
): Promise<ChangeError> => {
  const packageNamespace = await getNamespace(element)
  return ({
    elemID: element.elemID,
    severity: 'Error',
    message: `Element is part of a package namespace ${packageNamespace}`,
    detailedMessage: detailedMessage ?? `Cannot ${action} ${element.elemID.getFullName()} because it is part of a package namespace: ${packageNamespace}`,
  })
}

const CUSTOM_FIELD_MODIFIABLE_ITEMS = new Set([
  'inlineHelpText',
  'businessOwnerUser',
  'businessOwnerGroup',
  'businessStatus',
  'complianceGroup',
  'securityClassification',
])

const CUSTOM_OBJECT_MODIFIABLE_ITEMS = new Set([
  'enableActivities',
  'enableBulkApi',
  'enableHistory',
  'enableReports',
  'allowInChatterGroups',
  'deploymentStatus',
  'allowSharing',
  'enableStreamingApi',
])

const getModifiedAnnotationNames = (change: Change): string[] => {
  const [before, after] = getAllChangeData(change)
  return detailedCompare(before, after)
    .map(valueDiff => valueDiff.id.createBaseID().path[0])
}
const isForbiddenFieldModification = (change: Change): boolean => (
  !getModifiedAnnotationNames(change)
    .every(fieldName => CUSTOM_FIELD_MODIFIABLE_ITEMS.has(fieldName))
)

const isForbiddenObjectModification = (change: Change): boolean => (
  !getModifiedAnnotationNames(change)
    .every(fieldName => CUSTOM_OBJECT_MODIFIABLE_ITEMS.has(fieldName))
)

const isInstalledPackageVersionChange = async (
  { before, after }: { before: InstanceElement; after: InstanceElement }
): Promise<boolean> => (
  await metadataType(after) === INSTALLED_PACKAGE_METADATA
  && before.value[PACKAGE_VERSION_FIELD_NAME] !== after.value[PACKAGE_VERSION_FIELD_NAME]
)

const changeValidator: ChangeValidator = async changes => {
  const installedPackagesChanges = await awu(changes)
    .filter(change => hasNamespace(getChangeData(change)))
    .toArray()
  const modificationInstalledPackagesChanges = await awu(installedPackagesChanges)
    .filter(isModificationChange)
    .toArray()

  const addRemoveErrors = await awu(installedPackagesChanges)
    .filter(async change => await isCustomObject(getChangeData(change)) || isFieldChange(change))
    .filter(isAdditionOrRemovalChange)
    .map(change => packageChangeError(change.action, getChangeData(change)))
    .toArray()

  const fieldModifyErrors = await awu(modificationInstalledPackagesChanges)
    .filter(async change => isFieldChange(change))
    .filter(isForbiddenFieldModification)
    .map(change => packageChangeError(
      change.action,
      getChangeData(change),
      `Cannot modify managed object: entity=CustomFieldDefinition. Modification only possible for ${Array.from(CUSTOM_FIELD_MODIFIABLE_ITEMS).join(', ')}`,
    ))
    .toArray()

  const objectModifyErrors = await awu(modificationInstalledPackagesChanges)
    .filter(async change => isCustomObject(getChangeData(change)))
    .filter(isForbiddenObjectModification)
    .map(change => packageChangeError(
      change.action,
      getChangeData(change),
      `Cannot modify managed object: entity=CustomObjectDefinition. Modification only possible for ${Array.from(CUSTOM_OBJECT_MODIFIABLE_ITEMS).join(', ')}`,
    ))
    .toArray()

  const removeObjectWithPackageFieldsErrors = awu(changes)
    .filter(isRemovalChange)
    .map(getChangeData)
    .filter(isObjectType)
    .filter(async obj =>
      !(await hasNamespace(obj))
      && awu(Object.values(obj.fields)).some(hasNamespace))
    .map(obj => packageChangeError(
      'remove',
      obj,
      `Cannot remove type with id ${obj.elemID.getFullName()} because some of its fields belong to a managed package`,
    ))
    .toArray()

  const packageVersionChangeErrors = await awu(changes)
    .filter(isInstanceChange)
    .filter(isModificationChange)
    .filter(change => isInstalledPackageVersionChange(change.data))
    .map(change => packageChangeError(
      change.action,
      getChangeData(change),
      `Cannot change installed package version with id: ${getChangeData(change).elemID.getFullName()}`,
    ))
    .toArray()

  return [
    ...addRemoveErrors,
    ...fieldModifyErrors,
    ...objectModifyErrors,
    ...await removeObjectWithPackageFieldsErrors,
    ...packageVersionChangeErrors,
  ]
}

export default changeValidator
