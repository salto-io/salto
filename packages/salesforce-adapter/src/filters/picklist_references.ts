/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  Element,
  Field,
  InstanceElement,
  isField,
  isInstanceElement,
  isObjectType,
  isReferenceExpression,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { GLOBAL_VALUE_SET } from './global_value_sets'
import { STANDARD_VALUE_SET } from './standard_value_sets'
import { apiNameSync, buildElementsSourceForFetch, isInstanceOfTypeSync, metadataTypeSync } from './utils'
import { FIELD_ANNOTATIONS, RECORD_TYPE_METADATA_TYPE, VALUE_SET_FIELDS } from '../constants'
import { ORDERED_MAP_VALUES_FIELD } from './convert_maps'

const log = logger(module)
const { toArrayAsync } = collections.asynciterable

type PicklistValuesReferenceIndex = Record<string, Record<string, ReferenceExpression>>

const getValueSetFieldName = (typeName: string): string => {
  switch (typeName) {
    case GLOBAL_VALUE_SET:
      return 'customValue'
    case STANDARD_VALUE_SET:
      return 'standardValue'
    default:
      return 'valueSet'
  }
}
export type RecordTypePicklistValuesItem = {
  picklist: ReferenceExpression<Field>
  values: {
    fullName: string
  }[]
}

const isRecordTypePicklistValuesItem = (value: unknown): value is RecordTypePicklistValuesItem =>
  _.isObject(value) &&
  isReferenceExpression(_.get(value, 'picklist')) &&
  isField(_.get(value, 'picklist').value) &&
  _.isArray(_.get(value, 'values')) &&
  _.every(_.get(value, 'values'), v => _.isObject(v) && _.isString(_.get(v, 'fullName')))

const isRecordTypePicklistValues = (value: unknown): value is RecordTypePicklistValuesItem[] =>
  _.isArray(value) && value.every(isRecordTypePicklistValuesItem)

type OrderedValueSet = {
  values: Record<
    string,
    {
      fullName: string | ReferenceExpression
    }
  >
}

const isOrderedValueSet = (value: unknown): value is OrderedValueSet => {
  const picklistValues: unknown = _.get(value, 'values')
  return (
    _.isObject(picklistValues) &&
    Object.values(picklistValues).every(v => {
      const fullName = _.get(v, 'fullName')
      return _.isString(fullName) || isReferenceExpression(fullName)
    })
  )
}

const getValueSetElementFromPicklistField = (field: Field): InstanceElement | Field => {
  const valueSetName = field.annotations[VALUE_SET_FIELDS.VALUE_SET_NAME]
  if (isReferenceExpression(valueSetName) && isInstanceElement(valueSetName.value)) {
    return valueSetName.value
  }
  return field
}

const createReferencesForRecordType = (
  recordType: InstanceElement,
  picklistValuesReferenceIndex: PicklistValuesReferenceIndex,
): void => {
  const recordTypePicklistValues = recordType.value.picklistValues
  if (!isRecordTypePicklistValues(recordTypePicklistValues)) {
    return
  }
  recordTypePicklistValues.forEach(({ picklist, values }) => {
    const field = picklist.value
    const valueSetElement = getValueSetElementFromPicklistField(field)
    values.forEach(value => {
      const ref: ReferenceExpression | undefined =
        picklistValuesReferenceIndex[valueSetElement.elemID.getFullName()]?.[value.fullName]
      if (ref) {
        _.set(value, 'fullName', ref)
      } else {
        log.warn('Failed to resolve picklist value %s in field %s', value.fullName, field.elemID.getFullName())
      }
    })
  })
}

const createPicklistValuesReferenceIndex = (elements: Element[]): PicklistValuesReferenceIndex => {
  const result: PicklistValuesReferenceIndex = {}
  elements.filter(isInstanceOfTypeSync(GLOBAL_VALUE_SET, STANDARD_VALUE_SET)).forEach(instance => {
    const fieldName = getValueSetFieldName(metadataTypeSync(instance))
    const values = instance.value[fieldName]
    if (!isOrderedValueSet(values)) {
      return
    }
    const refIndex: Record<string, ReferenceExpression> = {}
    Object.entries(values.values).forEach(([key, value]) => {
      const fullName = _.isString(value.fullName) ? value.fullName : apiNameSync(value.fullName.value) ?? ''
      refIndex[fullName] = new ReferenceExpression(
        instance.elemID.createNestedID(fieldName, ORDERED_MAP_VALUES_FIELD, key, 'fullName'),
        fullName,
      )
    })
    result[instance.elemID.getFullName()] = refIndex
  })
  elements
    .filter(isObjectType)
    .flatMap(object => Object.values(object.fields))
    .forEach(field => {
      const valueSet = field.annotations[FIELD_ANNOTATIONS.VALUE_SET]
      if (!isOrderedValueSet(valueSet)) {
        return
      }
      const refIndex: Record<string, ReferenceExpression> = {}
      Object.entries(valueSet.values).forEach(([key, value]) => {
        const fullName = _.isString(value.fullName) ? value.fullName : apiNameSync(value.fullName.value) ?? ''
        refIndex[fullName] = new ReferenceExpression(
          field.elemID.createNestedID(FIELD_ANNOTATIONS.VALUE_SET, ORDERED_MAP_VALUES_FIELD, key, 'fullName'),
          fullName,
        )
      })
      result[field.elemID.getFullName()] = refIndex
    })
  return result
}

/**
 * This filter modifies picklist values in `RecordType` to be references to the original value definitions.
 */
const filterCreator: FilterCreator = ({ config }) => ({
  name: 'picklistReferences',
  onFetch: async elements => {
    const picklistValuesReferenceIndex = createPicklistValuesReferenceIndex(
      await toArrayAsync(await buildElementsSourceForFetch(elements, config).getAll()),
    )
    elements
      .filter(isInstanceOfTypeSync(RECORD_TYPE_METADATA_TYPE))
      .forEach(instance => createReferencesForRecordType(instance, picklistValuesReferenceIndex))
  },
})

export default filterCreator
