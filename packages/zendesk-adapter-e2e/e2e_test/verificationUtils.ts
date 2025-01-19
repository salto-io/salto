/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Element,
  InstanceElement,
  isReferenceExpression,
  isStaticFile,
  isTemplateExpression,
  ReferenceExpression,
  StaticFile,
} from '@salto-io/adapter-api'
import _, { isArray, isPlainObject } from 'lodash'
import {
  CUSTOM_FIELD_OPTIONS_FIELD_NAME,
  CUSTOM_OBJECT_FIELD_TYPE_NAME,
  CUSTOM_OBJECT_TYPE_NAME,
} from '@salto-io/zendesk-adapter'

const verifyArray = (originalArray: Array<unknown>, fetchArray: Array<unknown>): void => {
  const originalVals = originalArray.map(val => (isReferenceExpression(val) ? val.elemID.getFullName() : val))
  const fetchVals = fetchArray.map(val => (isReferenceExpression(val) ? val.elemID.getFullName() : val))
  expect(originalVals).toEqual(fetchVals)
}
const verifyStaticFile = (originalStaticFile: StaticFile, fetchStaticFile: StaticFile): void => {
  expect(originalStaticFile.filepath).toEqual(fetchStaticFile.filepath)
  expect(originalStaticFile.encoding).toEqual(fetchStaticFile.encoding)
  expect(originalStaticFile.hash).toEqual(fetchStaticFile.hash)
}

// we don't use isEqualElement because we can't control the fields that are being compared. in this case originalInstance
// has less fields then fetchInstance, causing isEqualElement to fail
export const verifyInstanceValues = (
  fetchInstance: InstanceElement | undefined,
  originalInstance: InstanceElement,
  fieldsToCheck: string[],
): void => {
  expect(fetchInstance == null).toBeFalsy()
  if (fetchInstance == null) {
    return
  }
  const originalInstanceValues = originalInstance.value
  const fetchInstanceValues = _.pick(fetchInstance.value, fieldsToCheck)
  fieldsToCheck.forEach(field => {
    if (isReferenceExpression(originalInstanceValues[field]) && isReferenceExpression(fetchInstanceValues[field])) {
      expect(fetchInstanceValues[field].elemID.getFullName()).toEqual(
        originalInstanceValues[field].elemID.getFullName(),
      )
    } else if (isArray(originalInstanceValues[field]) && isArray(fetchInstanceValues[field])) {
      verifyArray(originalInstanceValues[field], fetchInstanceValues[field])
    } else if (
      isTemplateExpression(originalInstanceValues[field]) &&
      isTemplateExpression(fetchInstanceValues[field])
    ) {
      verifyArray(originalInstanceValues[field].parts, fetchInstanceValues[field].parts)
    } else if (isPlainObject(originalInstanceValues[field]) && isPlainObject(fetchInstanceValues[field])) {
      const fields = Object.keys(originalInstanceValues[field])
      expect(_.pick(fetchInstanceValues[field], fields)).toEqual(originalInstanceValues[field])
    } else if (isStaticFile(originalInstanceValues[field]) && isStaticFile(fetchInstanceValues[field])) {
      verifyStaticFile(originalInstanceValues[field], fetchInstanceValues[field])
    } else {
      expect(fetchInstanceValues[field]).toEqual(originalInstanceValues[field])
    }
  })
}
export const verifyCustomObject = (instance: Element, instanceToAdd: InstanceElement): void => {
  const instanceClone = (instance as InstanceElement).clone()
  const instanceToAddClone = instanceToAdd.clone()
  const fieldToHandle =
    instanceClone.elemID.typeName === CUSTOM_OBJECT_TYPE_NAME
      ? `${CUSTOM_OBJECT_FIELD_TYPE_NAME}s`
      : CUSTOM_FIELD_OPTIONS_FIELD_NAME

  instanceClone.value[fieldToHandle] = (instanceClone.value[fieldToHandle] ?? [])
    .map((ref: ReferenceExpression) => ref.elemID.getFullName())
    .sort()
  instanceToAddClone.value[fieldToHandle] = (instanceToAddClone.value[fieldToHandle] ?? [])
    .map((ref: ReferenceExpression) => ref.elemID.getFullName())
    .sort()

  expect(instanceClone.value).toMatchObject(instanceToAddClone.value)
}
