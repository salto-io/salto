/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  ChangeError,
  ChangeValidator,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceChange,
  Value,
} from '@salto-io/adapter-api'
import {
  APEX_CLASS_METADATA_TYPE,
  APEX_COMPONENT_METADATA_TYPE,
  APEX_PAGE_METADATA_TYPE,
  APEX_TRIGGER_METADATA_TYPE,
  EMAIL_TEMPLATE_METADATA_TYPE,
} from '../constants'

const TYPES_TO_VALIDATE_TO_EXACT_VERSION = new Map<string, boolean>([
  [APEX_CLASS_METADATA_TYPE, false],
  [APEX_PAGE_METADATA_TYPE, false],
  [APEX_COMPONENT_METADATA_TYPE, false],
  [EMAIL_TEMPLATE_METADATA_TYPE, false],
  [APEX_TRIGGER_METADATA_TYPE, true],
])

const isOfTypeToValidate = (instance: InstanceElement): boolean =>
  Array.from(TYPES_TO_VALIDATE_TO_EXACT_VERSION.keys()).some(type => type === instance.getTypeSync().elemID.typeName)

const getVersionNumberSplitted = (namespace: Value): Number => {
  const numberAsNumber = Number(namespace.resValue.value.versionNumber)
  return numberAsNumber !== undefined ? numberAsNumber : -1
}

const convertNumStringsToNumber = (major: string, minor: string): Number => {
  const num = Number(`${major}.${minor}`)
  return num !== undefined ? num : -1
}

const createPackageVersionErrors = (instance: InstanceElement): ChangeError[] => {
  const errors: ChangeError[] = []
  if (instance.value.packageVersions === undefined) {
    return []
  }
  instance.value.packageVersions.forEach(
    (packageVersion: { majorNumber: string; minorNumber: string; namespace: Value }, index: Number) => {
      const { majorNumber, minorNumber, namespace } = packageVersion
      const packageVersionNumber = getVersionNumberSplitted(namespace)
      const instanceVersion = convertNumStringsToNumber(majorNumber, minorNumber)
      if (
        TYPES_TO_VALIDATE_TO_EXACT_VERSION.get(instance.elemID.typeName) &&
        instanceVersion !== packageVersionNumber
      ) {
        errors.push({
          elemID: instance.elemID.createNestedID('packageVersions', String(index)),
          severity: 'Warning',
          message: "Cannot deploy instances with different package version than target environment's package version",
          detailedMessage: `${namespace.resValue.value.fullName}'s version at the target environment is ${packageVersionNumber}, while ${instanceVersion} at the instance`,
        })
      } else if (instanceVersion > packageVersionNumber) {
        errors.push({
          elemID: instance.elemID.createNestedID('packageVersions', String(index)),
          severity: 'Warning',
          message: "Cannot deploy instances with greater package version than target environment's package version",
          detailedMessage: `${namespace.resValue.value.fullName}'s version at the target environment is ${packageVersionNumber}, while ${instanceVersion} at the instance`,
        })
      }
    },
  )
  return errors
}

const changeValidator: ChangeValidator = async changes => {
  const instanceChangesErrors = changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(isOfTypeToValidate)
    .flatMap(createPackageVersionErrors)
  return instanceChangesErrors
}

export default changeValidator
