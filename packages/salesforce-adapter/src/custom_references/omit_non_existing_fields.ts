/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ChangeError, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { isCustomMetadataRecordInstanceSync, isInstanceOfCustomObjectSync } from '../filters/utils'
import { WeakReferencesHandler } from '../types'

const fixValuesAndcreateError = (instance: InstanceElement, invalidValues: string[]): ChangeError => {
  invalidValues.forEach(value => {
    delete instance.value[value]
  })
  const createErrorMessage = (): ChangeError => ({
    elemID: instance.elemID,
    severity: 'Info' as const,
    message: "Omitting invalid values that don't exist as instance type's field",
    detailedMessage: `The ${instance.elemID.getFullName()} has values that don't exist as ${instance.elemID.typeName}'s field. Fields omitted: ${invalidValues.join(', ')}`,
  })
  return createErrorMessage()
}

const removeWeakReferences: WeakReferencesHandler['removeWeakReferences'] = () => async elements => {
  const instanceElements = elements
    .filter(isInstanceElement)
    .filter(element => isInstanceOfCustomObjectSync(element) || isCustomMetadataRecordInstanceSync(element))
    .map(instance => instance.clone())
  const fixedElements: InstanceElement[] = []
  const errors: ChangeError[] = []
  const fromTypeToValidFields: Map<string, Set<string>> = new Map()
  instanceElements.forEach(instance => {
    const { typeName } = instance.elemID
    if (!fromTypeToValidFields.has(typeName)) {
      const instanceType = instance.getTypeSync()
      fromTypeToValidFields.set(typeName, new Set(Object.keys(instanceType.fields)))
    }
    const invalidValues = Object.keys(instance.value)
      .map(value => {
        const validFields = fromTypeToValidFields.get(typeName)
        return !validFields?.has(value) ? value : ''
      })
      .filter(value => value !== '')
    if (invalidValues.length > 0) {
      fixedElements.push(instance)
      errors.push(fixValuesAndcreateError(instance, invalidValues))
    }
  })
  return { fixedElements, errors }
}

export const omitNonExistingFieldsHandler: WeakReferencesHandler = {
  findWeakReferences: async () => [],
  removeWeakReferences,
}
