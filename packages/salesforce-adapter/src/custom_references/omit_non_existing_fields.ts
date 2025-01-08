/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ChangeError, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import _ from 'lodash'
import { isCustomMetadataRecordInstanceSync, isInstanceOfCustomObjectSync } from '../filters/utils'
import { WeakReferencesHandler } from '../types'

const omitNonExistingFields: WeakReferencesHandler['removeWeakReferences'] = () => async elements => {
  const instanceElements = elements
    .filter(isInstanceElement)
    .filter(element => isInstanceOfCustomObjectSync(element) || isCustomMetadataRecordInstanceSync(element))
  const fixedElements: InstanceElement[] = []
  const errors: ChangeError[] = []
  const unknownFieldsByType: Map<string, Set<string>> = new Map()
  instanceElements.forEach(instance => {
    const { typeName } = instance.elemID
    if (!unknownFieldsByType.has(typeName)) {
      const instanceType = instance.getTypeSync()
      unknownFieldsByType.set(typeName, new Set(Object.keys(instanceType.fields)))
    }
    const unknownFields = Object.keys(instance.value)
      .map(value => {
        const validFields = unknownFieldsByType.get(typeName)
        return !validFields?.has(value) ? value : ''
      })
      .filter(value => value !== '')
    if (unknownFields.length > 0) {
      const clonedInstance = instance.clone()
      clonedInstance.value = _.omit(clonedInstance.value, unknownFields)
      fixedElements.push(clonedInstance)
      errors.push({
        elemID: clonedInstance.elemID,
        severity: 'Info' as const,
        message: 'Omitted values of fields that are not defined in the type',
        detailedMessage: `Omitted the following values: ${unknownFields.join(', ')}`,
      })
    }
  })
  return { fixedElements, errors }
}

export const omitNonExistingFieldsHandler: WeakReferencesHandler = {
  findWeakReferences: async () => [],
  removeWeakReferences: omitNonExistingFields,
}
