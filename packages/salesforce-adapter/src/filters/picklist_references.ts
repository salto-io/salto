/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  CORE_ANNOTATIONS,
  getChangeData,
  InstanceElement,
  isReferenceExpression,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { inspectValue, naclCase } from '@salto-io/adapter-utils'
import { values } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { GLOBAL_VALUE_SET } from './global_value_sets'
import { STANDARD_VALUE_SET } from './standard_value_sets'
import { ORDERED_MAP_VALUES_FIELD } from './convert_maps'
import { isInstanceOfTypeSync } from './utils'
import { RECORD_TYPE_METADATA_TYPE } from '../constants'

const log = logger(module)
const { isDefined } = values

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

export type PicklistValuesItem = {
  picklist: string
  values: {
    fullName?: string
    value?: ReferenceExpression | { fullName: string }
  }[]
}

/**
 * Replace all picklist value full names with a reference to the original value definition.
 * Modifies the picklistValues in place.
 *
 * @param recordType        a RecordType instance to modify
 * @param picklistValues    The picklistValues of a RecordType instance to modify
 */
const addPicklistValueReferences = (recordType: InstanceElement, picklistValues: PicklistValuesItem): void => {
  // Get a reference to the underlying picklist that contains the values. We need to handle several cases:
  // 1. On onFetch, the picklist is a reference expression while on preDeploy and onDeploy it's a string with the parent field name.
  // 2. There's a possible second level of indirection where the picklist field in the parent doesn't contain the actual values but
  //    is a reference to the actual picklist.
  const recordTypeParent =
    recordType.annotations[CORE_ANNOTATIONS.PARENT][0].value ?? recordType.annotations[CORE_ANNOTATIONS.PARENT][0]
  const picklistRef: ReferenceExpression = isReferenceExpression(picklistValues.picklist)
    ? picklistValues.picklist?.value?.annotations?.valueSetName ?? picklistValues.picklist
    : recordTypeParent.fields[picklistValues.picklist]?.annotations?.valueSetName ??
      new ReferenceExpression(recordTypeParent.elemID.createNestedID('field', picklistValues.picklist))

  if (!isReferenceExpression(picklistRef)) {
    log.warn('Expected RecordType picklist to be a reference expression, got: %s', picklistRef)
    return
  }
  if (picklistValues.values.some(({ fullName }: { fullName?: string }) => fullName === undefined)) {
    log.warn(
      'Expected all RecordType picklist values to have a valid fullName, got undefined: %s',
      inspectValue(picklistValues.values),
    )
    return
  }
  picklistValues.values = picklistValues.values.map(value => ({
    ..._.omit(value, 'fullName'),
    value: new ReferenceExpression(
      picklistRef.elemID.createNestedID(
        getValueSetFieldName(picklistRef.elemID.typeName),
        ORDERED_MAP_VALUES_FIELD,
        naclCase(decodeURIComponent(value.fullName!)),
      ),
    ),
  }))
}

/**
 * Resolve all picklist value references with the original full names.
 * This is the reverse operation, to be used before deployment.
 *
 * @param picklistValues    The picklistValues of a RecordType instance to modify
 */
const resolvePicklistValueReferences = (picklistValues: PicklistValuesItem): void => {
  picklistValues.values = picklistValues.values.map(({ value, ...rest }) => {
    if (value === undefined || isReferenceExpression(value)) {
      log.warn(
        'Expected all RecordType picklist values to have a valid fullName, got undefined: %s',
        inspectValue(value),
      )
      return { value, ...rest }
    }
    return {
      fullName: value.fullName,
      ...rest,
    }
  })
}

/**
 * This filter modifies picklist values in `RecordType` to be references to the original value definitions.
 */
const filterCreator: FilterCreator = ({ config }) => {
  if (!config.fetchProfile.isFeatureEnabled('picklistsAsMaps')) {
    return {
      name: 'picklistReferences',
    }
  }

  return {
    name: 'picklistReferences',
    onFetch: async elements =>
      elements
        .filter(isInstanceOfTypeSync(RECORD_TYPE_METADATA_TYPE))
        .flatMap(recordType =>
          recordType.value.picklistValues?.map((picklistValueItem: PicklistValuesItem) => [
            recordType,
            picklistValueItem,
          ]),
        )
        .filter(isDefined)
        .forEach(([recordType, pvi]) => addPicklistValueReferences(recordType, pvi)),

    preDeploy: async changes =>
      changes
        .map(getChangeData)
        .filter(isInstanceOfTypeSync(RECORD_TYPE_METADATA_TYPE))
        .flatMap(recordType => recordType.value.picklistValues)
        .filter(isDefined)
        .forEach(resolvePicklistValueReferences),

    onDeploy: async changes =>
      changes
        .map(getChangeData)
        .filter(isInstanceOfTypeSync(RECORD_TYPE_METADATA_TYPE))
        .flatMap(recordType =>
          recordType.value.picklistValues?.map((picklistValueItem: PicklistValuesItem) => [
            recordType,
            picklistValueItem,
          ]),
        )
        .filter(isDefined)
        .forEach(([recordType, pvi]) => addPicklistValueReferences(recordType, pvi)),
  }
}

export default filterCreator
