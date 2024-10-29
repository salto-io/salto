/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Change, getChangeData, isReferenceExpression, ReferenceExpression } from '@salto-io/adapter-api'
import { naclCase } from '@salto-io/adapter-utils'
import { values } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { GLOBAL_VALUE_SET } from './global_value_sets'
import { STANDARD_VALUE_SET } from './standard_value_sets'
import { getElementValueOrAnnotations, ORDERED_MAP_VALUES_FIELD } from './convert_maps'
import { isInstanceOfTypeSync } from './utils'
import { RECORD_TYPE_METADATA_TYPE } from '../constants'
import { Promise } from '@salto-io/jsforce'
import _ from 'lodash'

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

type PicklistValuesItem = {
  picklist: ReferenceExpression
  values: { fullName: string }[]
}

type PicklistValuesItemWithReferences = {
  picklist: ReferenceExpression
  values: { value: ReferenceExpression }[]
}

const addReferencesToPicklistValues = (picklistValues: PicklistValuesItem): PicklistValuesItemWithReferences => ({
  picklist: picklistValues.picklist,
  values: picklistValues.values.map(value => {
    const { fullName, ...rest } = value
    return {
      ...rest,
      value: new ReferenceExpression(
        picklistValues.picklist.elemID.createNestedID(
          getValueSetFieldName(picklistValues.picklist.elemID.typeName),
          ORDERED_MAP_VALUES_FIELD,
          naclCase(decodeURIComponent(value.fullName)),
        ),
      ),
    }
  }),
})

const resolveReferencesInPicklistValues = (picklistValues: PicklistValuesItemWithReferences): PicklistValuesItem => {
  picklistValues.values = picklistValues.values.map((value: { value: ReferenceExpression }) => ({
    ...value,
    fullName: value.value.elemID.name,
  }))
}

/**
 * This filter modifies picklist values in `RecordType` to be references to the original value definitions.
 */
const filterCreator: FilterCreator = ({ config }) => ({
  name: 'picklistReferences',
  onFetch: async elements => {
    if (!config.fetchProfile.isFeatureEnabled('picklistsAsMaps')) {
      return
    }
    // Find record types with picklist fields and convert them to reference expressions
    const recordTypes = elements.filter(isInstanceOfTypeSync(RECORD_TYPE_METADATA_TYPE))
    const picklistValuesItem = recordTypes.flatMap(rt => rt.value.picklistValues).filter(isDefined)
    picklistValuesItem.forEach(picklistValues => {
      const picklistRef: ReferenceExpression | undefined =
        // Some picklist references are themselves references to value sets, while others are direct picklists references.
        picklistValues.picklist?.value?.annotations?.valueSetName ?? picklistValues.picklist
      if (!isReferenceExpression(picklistRef)) {
        log.warn('Expected RecordType picklist to be a reference expression, got: %s', picklistRef)
        return
      }
      if (picklistValues.values.filter(({ fullName }: { fullName?: string }) => fullName === undefined).length > 0) {
        log.warn(
          'Expected all RecordType picklist values to have a valid fullName, got undefined: %o',
          picklistValues.values,
        )
        return
      }
      picklistValues.values = picklistValues.values.map((value: { fullName: string }) => {
        const valueRefPath = [
          getValueSetFieldName(picklistRef.elemID.typeName),
          ORDERED_MAP_VALUES_FIELD,
          naclCase(decodeURIComponent(value.fullName)),
        ]
        const resValue = _.get(getElementValueOrAnnotations(picklistRef.value), valueRefPath)
        const { fullName, ...rest } = value
        return {
          ...rest,
          value: new ReferenceExpression(
            picklistRef.elemID.createNestedID(
              getValueSetFieldName(picklistRef.elemID.typeName),
              ORDERED_MAP_VALUES_FIELD,
              naclCase(decodeURIComponent(value.fullName)),
            ),
            resValue,
          ),
        }
      })
    })
  },

  preDeploy: async changes => {
    changes
      .map(getChangeData)
      .filter(isInstanceOfTypeSync(RECORD_TYPE_METADATA_TYPE))
      .flatMap(rt => rt.value.picklistValues)
      .filter(isDefined)
      .forEach(picklistValues => {
        if (picklistValues.values.some(({ value }: { value?: ReferenceExpression }) => value === undefined)) {
          return
        }
        picklistValues.values = picklistValues.values.map(({ value, ...rest }: { value: ReferenceExpression }) => ({
          fullName: value.value.fullName,
          ...rest,
        }))
      })
  },

  onDeploy: async changes => {
    changes
      .map(getChangeData)
      .filter(isInstanceOfTypeSync(RECORD_TYPE_METADATA_TYPE))
      .flatMap(rt => rt.value.picklistValues)
      .filter(isDefined)
      .forEach(picklistValues => {
        picklistValues.values = picklistValues.values.map(
          ({ value, default: isDefault }: { value: ReferenceExpression; default: boolean }) => ({
            fullName: value.value.fullName,
            default: isDefault,
          }),
        )
      })
  },
})

export default filterCreator
