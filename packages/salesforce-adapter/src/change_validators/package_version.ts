/*
 * Copyright 2025 Salto Labs Ltd.
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
import { values as lowerDashValues } from '@salto-io/lowerdash'
import _ from 'lodash'
import {
  APEX_CLASS_METADATA_TYPE,
  APEX_COMPONENT_METADATA_TYPE,
  APEX_PAGE_METADATA_TYPE,
  APEX_TRIGGER_METADATA_TYPE,
  EMAIL_TEMPLATE_METADATA_TYPE,
} from '../constants'
import { isInstanceOfTypeSync } from '../filters/utils'

const { isDefined } = lowerDashValues

type PackageVersion = {
  majorNumber: Number
  minorNumber: Number
  namespace: ReferenceExpression
}

type Version = {
  major: Number
  minor: Number
}

export const TYPES_PACKAGE_VERSION_NO_GREATER_VERSION = new Set([
  APEX_CLASS_METADATA_TYPE,
  APEX_PAGE_METADATA_TYPE,
  APEX_COMPONENT_METADATA_TYPE,
  EMAIL_TEMPLATE_METADATA_TYPE,
])
export const TYPES_PACKAGE_VERSION_EXACT_VERSION = new Set([APEX_TRIGGER_METADATA_TYPE])

const isPackageVersionType = (val: Value): val is PackageVersion =>
  _.isPlainObject(val) &&
  _.isNumber(val.majorNumber) &&
  _.isNumber(val.minorNumber) &&
  isReferenceExpression(val.namespace) &&
  isInstanceElement(val.namespace.value) &&
  _.isString(_.get(val.namespace.value.value, ['versionNumber']))

const parsePackageVersion = (namespace: ReferenceExpression): Version | undefined => {
  const versionParts = namespace.value.value.versionNumber.split('.')
  const major = parseInt(versionParts[0], 10)
  const minor = parseInt(versionParts[1], 10)
  return versionParts.length === 2 && major !== undefined && minor !== undefined ? { major, minor } : undefined
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
  // const errors: ChangeError[] = []
  if (!Array.isArray(instance.value.packageVersions)) {
    return []
  }
  return instance.value.packageVersions
    .filter(isPackageVersionType)
    .map<ChangeError | undefined>((packageVersion: PackageVersion, index: Number) => {
      const { instanceVersion, namespace } = destructPackageVersion(packageVersion)
      const targetVersion = parsePackageVersion(namespace)
      if (instance !== undefined && targetVersion !== undefined) {
        if (
          TYPES_PACKAGE_VERSION_EXACT_VERSION.has(instance.elemID.typeName) &&
          !isExactVersion(instanceVersion, targetVersion)
        ) {
          return {
            elemID: instance.elemID.createNestedID('packageVersions', String(index)),
            severity: 'Warning',
            message:
              'Cannot deploy instances with a package version that does not match the version in the target environment',
            detailedMessage: `${namespace.value.value.fullName}'s version in the target environment is ${printableVersion(targetVersion)} and ${printableVersion(instanceVersion)} in the instance`,
          }
        }
        if (isGreaterVersion(instanceVersion, targetVersion)) {
          return {
            elemID: instance.elemID.createNestedID('packageVersions', String(index)),
            severity: 'Warning',
            message:
              'Cannot deploy instances with a package version that is greater than the version in the target environment',
            detailedMessage: `${namespace.value.value.fullName}'s version in the target environment is ${printableVersion(targetVersion)} and ${printableVersion(instanceVersion)} in the instance`,
          }
        }
      }
      return undefined
    })
    .filter(isDefined)
}

const changeValidator: ChangeValidator = async changes =>
  changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(isInstanceOfTypeSync(...TYPES_PACKAGE_VERSION_EXACT_VERSION, ...TYPES_PACKAGE_VERSION_NO_GREATER_VERSION))
    .flatMap(createPackageVersionErrors)

export default changeValidator
