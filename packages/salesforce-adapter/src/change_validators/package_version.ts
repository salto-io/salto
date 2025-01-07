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

type PackageVersionType = {
  majorNumber: string
  minorNumber: string
  namespace: ReferenceExpression | string
}

const isPackageVersionType = (val: Value): val is PackageVersionType =>
  typeof val === 'object' &&
  val !== null &&
  typeof val.majorNumber === 'number' &&
  typeof val.minorNumber === 'number' &&
  (isReferenceExpression(val.namespace) || typeof val.namespace === 'string') // namespace might be string NEED TO FIX WHAT HAPPENS IF NAMESPACE IS NOT REFERENCE

const isArrayOfPackageVersionTypes = (arr: Value[]): arr is PackageVersionType[] => {
  const a = Array.isArray(arr)
  const b = arr.every(isPackageVersionType)
  return a && b
}

export const TYPES_PACKAGE_VERSION_MATCHING_EXACT_VERSION: Record<string, ExactVersion> = {
  [APEX_CLASS_METADATA_TYPE]: { exactVersion: false },
  [APEX_PAGE_METADATA_TYPE]: { exactVersion: false },
  [APEX_COMPONENT_METADATA_TYPE]: { exactVersion: false },
  [EMAIL_TEMPLATE_METADATA_TYPE]: { exactVersion: false },
  [APEX_TRIGGER_METADATA_TYPE]: { exactVersion: true },
}

type PackageVersionInstanceElement = InstanceElement & {
  versionNumber: string
}

const isPackageVersionInstanceElement = (element: InstanceElement): element is PackageVersionInstanceElement =>
  isInstanceElement(element) && _.isString(_.get(element.value, ['versionNumber']))

const getVersionNumber = (namespace: Value): Number | undefined => {
  if (!isReferenceExpression(namespace) || !isPackageVersionInstanceElement(namespace.value)) {
    return undefined
  }
  const numberAsNumber = Number(namespace.value.value.versionNumber)
  return !Number.isNaN(numberAsNumber) ? numberAsNumber : undefined
}

const convertNumStringsToNumber = (major: string, minor: string): Number | undefined => {
  const num = Number(`${major}.${minor}`)
  return !Number.isNaN(num) ? num : undefined
}

const createPackageVersionErrors = (instance: InstanceElement): ChangeError[] => {
  const errors: ChangeError[] = []
  if (!isArrayOfPackageVersionTypes(instance.value.packageVersions)) {
    return []
  }
  instance.value.packageVersions.forEach(
    (packageVersion: { majorNumber: string; minorNumber: string; namespace: Value }, index: Number) => {
      const { majorNumber, minorNumber, namespace } = packageVersion
      const packageVersionNumber = getVersionNumber(namespace)
      const instanceVersion = convertNumStringsToNumber(majorNumber, minorNumber)
      if (instanceVersion !== undefined && packageVersionNumber !== undefined) {
        if (
          TYPES_PACKAGE_VERSION_MATCHING_EXACT_VERSION[instance.elemID.typeName].exactVersion &&
          instanceVersion !== packageVersionNumber
        ) {
          errors.push({
            elemID: instance.elemID.createNestedID('packageVersions', String(index)),
            severity: 'Warning',
            message:
              "Cannot deploy instances with a different package version than target environment's package version",
            detailedMessage: `${namespace.value.fullName}'s version at the target environment is ${packageVersionNumber} and ${instanceVersion} in the instance`,
          })
        } else if (instanceVersion > packageVersionNumber) {
          errors.push({
            elemID: instance.elemID.createNestedID('packageVersions', String(index)),
            severity: 'Warning',
            message: "Cannot deploy instances with a greater package version than target environment's package version",
            detailedMessage: `${namespace.value.fullName}'s version at the target environment is ${packageVersionNumber} and ${instanceVersion} in the instance`,
          })
        }
      }
    },
  )
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
