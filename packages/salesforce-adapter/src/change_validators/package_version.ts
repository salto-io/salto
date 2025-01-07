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
  isInstanceElement,
  isReferenceExpression,
  ReferenceExpression,
  Value,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import {
  APEX_CLASS_METADATA_TYPE,
  APEX_COMPONENT_METADATA_TYPE,
  APEX_PAGE_METADATA_TYPE,
  APEX_TRIGGER_METADATA_TYPE,
  EMAIL_TEMPLATE_METADATA_TYPE,
} from '../constants'
import { isInstanceOfTypeSync } from '../filters/utils'

export type ExactVersion = {
  exactVersion: boolean
}

type PackageVersion = {
  majorNumber: Number
  minorNumber: Number
  namespace: ReferenceExpression
}

type Version = {
  major: Number
  minor: Number
}

export const TYPES_PACKAGE_VERSION_MATCHING_EXACT_VERSION: Record<string, ExactVersion> = {
  [APEX_CLASS_METADATA_TYPE]: { exactVersion: false },
  [APEX_PAGE_METADATA_TYPE]: { exactVersion: false },
  [APEX_COMPONENT_METADATA_TYPE]: { exactVersion: false },
  [EMAIL_TEMPLATE_METADATA_TYPE]: { exactVersion: false },
  [APEX_TRIGGER_METADATA_TYPE]: { exactVersion: true },
}

const isPackageVersionType = (val: Value): val is PackageVersion =>
  _.isPlainObject(val) &&
  _.isNumber(val.majorNumber) &&
  _.isNumber(val.minorNumber) &&
  isReferenceExpression(val.namespace) &&
  isInstanceElement(val.namespace.value) &&
  _.isString(_.get(val.namespace.value.value, ['versionNumber']))

const getTargetVersionMajorMinor = (namespace: ReferenceExpression): Version | undefined => {
  const numberAsStrings = namespace.value.value.versionNumber.split('.')
  const major = _.toInteger(numberAsStrings[0])
  const minor = _.toInteger(numberAsStrings[1])
  return numberAsStrings.length === 2 && major !== undefined && minor !== undefined ? { major, minor } : undefined
}

const isExactVersion = (instanceVersion: Version, targetVersion: Version): boolean =>
  instanceVersion.major === targetVersion.major && instanceVersion.minor === targetVersion.minor

const isGreaterVersion = (instanceVersion: Version, targetVersion: Version): boolean =>
  instanceVersion.major > targetVersion.major ||
  (instanceVersion.major === targetVersion.major && instanceVersion.minor > targetVersion.minor)

const destructPackageVersion = (
  packageVersion: PackageVersion,
): { instanceVersion: Version; namespace: ReferenceExpression } => ({
  instanceVersion: { major: packageVersion.majorNumber, minor: packageVersion.minorNumber },
  namespace: packageVersion.namespace,
})

const printableVersion = (version: Version): string => `${version.major}.${version.minor}`

const createPackageVersionErrors = (instance: InstanceElement): ChangeError[] => {
  const errors: ChangeError[] = []
  if (!Array.isArray(instance.value.packageVersions)) {
    return []
  }
  instance.value.packageVersions
    .filter(isPackageVersionType)
    .forEach((packageVersion: PackageVersion, index: Number) => {
      const { instanceVersion, namespace } = destructPackageVersion(packageVersion)
      const targetVersion = getTargetVersionMajorMinor(namespace)
      if (instance !== undefined && targetVersion !== undefined) {
        if (
          TYPES_PACKAGE_VERSION_MATCHING_EXACT_VERSION[instance.elemID.typeName].exactVersion &&
          !isExactVersion(instanceVersion, targetVersion)
        ) {
          errors.push({
            elemID: instance.elemID.createNestedID('packageVersions', String(index)),
            severity: 'Warning',
            message:
              "Cannot deploy instances with a different package version than target environment's package version",
            detailedMessage: `${namespace.value.value.fullName}'s version at the target environment is ${printableVersion(targetVersion)} and ${printableVersion(instanceVersion)} in the instance`,
          })
        } else if (isGreaterVersion(instanceVersion, targetVersion)) {
          errors.push({
            elemID: instance.elemID.createNestedID('packageVersions', String(index)),
            severity: 'Warning',
            message: "Cannot deploy instances with a greater package version than target environment's package version",
            detailedMessage: `${namespace.value.value.fullName}'s version at the target environment is ${printableVersion(targetVersion)} and ${printableVersion(instanceVersion)} in the instance`,
          })
        }
      }
    })
  return errors
}

const changeValidator: ChangeValidator = async changes =>
  changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(isInstanceOfTypeSync(...Object.keys(TYPES_PACKAGE_VERSION_MATCHING_EXACT_VERSION)))
    .flatMap(createPackageVersionErrors)

export default changeValidator
