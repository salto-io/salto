/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { isObjectType, Element, isInstanceElement, ObjectType } from '@salto-io/adapter-api'
import { TransformFunc, transformValuesSync } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import { apiNameSync } from './utils'

const TYPE_NAME_TO_FIELD_REMOVALS: Map<string, string[]> = new Map([['Profile', ['tabVisibilities']]])

const fieldRemovalsForType = (type: ObjectType, typeNameToFieldRemovals: Map<string, string[]>): string[] => {
  const typeName = apiNameSync(type) ?? ''
  return typeNameToFieldRemovals.get(typeName) ?? []
}

export const removeFieldsFromTypes = (elements: Element[], typeNameToFieldRemovals: Map<string, string[]>): void => {
  elements.filter(isObjectType).forEach(type => {
    const fieldsToRemove = fieldRemovalsForType(type, typeNameToFieldRemovals)
    fieldsToRemove.forEach(fieldName => {
      delete type.fields[fieldName]
    })
  })
}

export const removeValuesFromInstances = (
  elements: Element[],
  typeNameToFieldRemovals: Map<string, string[]>,
): void => {
  const removeValuesFunc: TransformFunc = ({ value, field }) => {
    if (!field) return value
    const fieldsToRemove = fieldRemovalsForType(field.parent, typeNameToFieldRemovals)
    if (fieldsToRemove.includes(field.name)) {
      return undefined
    }
    return value
  }

  elements
    .filter(isInstanceElement)
    // The below filter is temporary optimization to save calling transformValues for all instances
    // since TYPE_NAME_TO_FIELD_REMOVALS contains currently only top level types
    .filter(inst => fieldRemovalsForType(inst.getTypeSync(), typeNameToFieldRemovals).length > 0)
    .forEach(inst => {
      inst.value =
        transformValuesSync({
          values: inst.value,
          type: inst.getTypeSync(),
          transformFunc: removeValuesFunc,
          strict: false,
          allowEmptyArrays: true,
          allowExistingEmptyObjects: true,
          pathID: inst.elemID,
        }) || inst.value
    })
}

/**
 * Declare the remove field and values filter, this filter removes fields from ObjectTypes and
 * their corresponding instances upon fetch.
 * */
export const makeFilter =
  (typeNameToFieldRemovals: Map<string, string[]>): FilterCreator =>
  ({ config }) => ({
    name: 'removeFieldsAndValuesFilter',
    onFetch: async (elements: Element[]) => {
      if (config.fetchProfile.isFeatureEnabled('supportProfileTabVisibilities')) {
        return
      }
      removeValuesFromInstances(elements, typeNameToFieldRemovals)
      removeFieldsFromTypes(elements, typeNameToFieldRemovals)
    },
  })

export default makeFilter(TYPE_NAME_TO_FIELD_REMOVALS)
