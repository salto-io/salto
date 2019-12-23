import {
  Change, Element, Field, getChangeElement, InstanceElement, isAdditionDiff, isField,
  isInstanceElement, isModificationDiff, isObjectType, isRemovalDiff, ChangeError,
} from 'adapter-api'
import _ from 'lodash'
import { apiName, metadataType } from '../transformers/transformer'
import { NAMESPACE_SEPARATOR, SALESFORCE_CUSTOM_SUFFIX } from '../constants'


export const hasNamespace = (customElement: Element): boolean => {
  const apiNameResult = apiName(customElement)
  if (_.isUndefined(apiNameResult)) {
    return false
  }
  if (isInstanceElement(customElement)) {
    const partialFullName = apiNameResult.split('-')[0]
    const cleanFullName = partialFullName.endsWith(SALESFORCE_CUSTOM_SUFFIX)
      ? partialFullName.slice(0, -3) : partialFullName
    return cleanFullName.includes(NAMESPACE_SEPARATOR)
  }
  return apiNameResult.split(NAMESPACE_SEPARATOR).length === 3 // <namespace>__<name>__c
}

export const getNamespace = (customElement: Element): string =>
  apiName(customElement).split(NAMESPACE_SEPARATOR)[0]

export const PACKAGE_VERSION_NUMBER_FIELD_NAME = 'version_number'
export const INSTALLED_PACKAGE_METADATA = 'InstalledPackage'

const generateAddPackageMessage = (namespace: string): string =>
  `You cannot install a package using Salto. Package namespace: ${namespace}`

const generateRemovePackageMessage = (namespace: string): string =>
  `You cannot remove a package using Salto. Package namespace: ${namespace}`

const generateModifyPackageVersionMessage = (namespace: string): string =>
  `You cannot modify the version of a package using Salto. Package namespace: ${namespace}`

export const changeValidator = {
  onAdd: (after: Element): ReadonlyArray<ChangeError> => {
    if ((isInstanceElement(after) || isObjectType(after)) && hasNamespace(after)) {
      return [{
        elemID: after.elemID,
        level: 'ERROR',
        message: generateAddPackageMessage(getNamespace(after)),
        detailedMessage: 'You cannot add an Instance or an Object to a package',
      }]
    }
    return []
  },

  onRemove: (before: Element): ReadonlyArray<ChangeError> => {
    if ((isInstanceElement(before) || isObjectType(before)) && hasNamespace(before)) {
      return [{
        elemID: before.elemID,
        level: 'ERROR',
        message: generateRemovePackageMessage(getNamespace(before)),
        detailedMessage: 'You cannot remove an Instance or an Object that are a part of a package',
      }]
    }
    return []
  },

  onUpdate: (changes: ReadonlyArray<Change>): ReadonlyArray<ChangeError> => {
    const isInstalledPackageVersionChange = (change: Change): boolean =>
      isInstanceElement(getChangeElement(change))
        && metadataType(getChangeElement(change)) === INSTALLED_PACKAGE_METADATA
        && isModificationDiff(change)
        && (change.data.before as InstanceElement).value[PACKAGE_VERSION_NUMBER_FIELD_NAME]
        !== (change.data.after as InstanceElement).value[PACKAGE_VERSION_NUMBER_FIELD_NAME]

    const isAddOrRemovePackageFieldChange = (change: Change): boolean => {
      const changeElement = getChangeElement(change)
      return isField(changeElement)
        && (isAdditionDiff(change) || isRemovalDiff(change))
        && !_.isUndefined(apiName(changeElement))
        && hasNamespace(changeElement)
    }

    const installedPackageVersionChange = changes.find(isInstalledPackageVersionChange)
    if (installedPackageVersionChange) {
      return [{
        elemID: getChangeElement(installedPackageVersionChange).elemID,
        level: 'ERROR',
        message: generateModifyPackageVersionMessage(
          getNamespace(getChangeElement(installedPackageVersionChange) as InstanceElement)
        ),
        detailedMessage: 'You cannot modify the version number of an InstalledPackage instance element',
      }]
    }
    return changes
      .filter(isAddOrRemovePackageFieldChange)
      .map(change => ({
        elemID: getChangeElement(change).elemID,
        level: 'ERROR',
        message: isAdditionDiff(change)
          ? generateAddPackageMessage(getNamespace(change.data.after as Field))
          : generateRemovePackageMessage(getNamespace(change.data.before as Field)),
        detailedMessage: 'You cannot add or remove a field that is a part of a package',
      }))
  },
}

export default changeValidator
