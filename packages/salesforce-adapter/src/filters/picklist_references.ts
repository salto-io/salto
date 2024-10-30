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
import { naclCase } from '@salto-io/adapter-utils'
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
  // TODO: Some picklist references are themselves references to value sets, while others are direct picklists references.
  const recordTypeParent = recordType.annotations[CORE_ANNOTATIONS.PARENT][0].value ?? recordType.annotations[CORE_ANNOTATIONS.PARENT][0]
  const picklistRef: ReferenceExpression =
    recordTypeParent.fields[picklistValues.picklist]?.annotations?.valueSetName ??
    new ReferenceExpression(recordTypeParent.elemID.createNestedID('field', picklistValues.picklist))
  if (!isReferenceExpression(picklistRef)) {
    log.warn('Expected RecordType picklist to be a reference expression, got: %s', picklistRef)
    return
  }
  if (picklistValues.values.some(({ fullName }: { fullName?: string }) => fullName === undefined)) {
    log.warn(
      'Expected all RecordType picklist values to have a valid fullName, got undefined: %o',
      picklistValues.values,
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
  if (picklistValues.values.some(value => value.fullName !== undefined || value.value === undefined)) {
    return
  }

  picklistValues.values = picklistValues.values.map(({ value, ...rest }) => ({
    fullName: (value as { fullName: string }).fullName,
    ...rest,
  }))
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
        .flatMap(rt => rt.value.picklistValues.map((picklistValueItem: PicklistValuesItem) => [rt, picklistValueItem]))
        .filter(isDefined)
        .forEach(([rt, pvi]) => addPicklistValueReferences(rt, pvi)),

    preDeploy: async changes =>
      changes
        .map(getChangeData)
        .filter(isInstanceOfTypeSync(RECORD_TYPE_METADATA_TYPE))
        .flatMap(rt => rt.value.picklistValues)
        .filter(isDefined)
        .forEach(resolvePicklistValueReferences),

    onDeploy: async changes =>
      changes
        .map(getChangeData)
        .filter(isInstanceOfTypeSync(RECORD_TYPE_METADATA_TYPE))
        .flatMap(rt => rt.value.picklistValues.map((picklistValueItem: PicklistValuesItem) => [rt, picklistValueItem]))
        .filter(isDefined)
        .forEach(([rt, pvi]) => addPicklistValueReferences(rt, pvi)),
  }
}

export default filterCreator
