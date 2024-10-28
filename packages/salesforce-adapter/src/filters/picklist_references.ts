/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { isReferenceExpression, ReferenceExpression } from '@salto-io/adapter-api'
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
      picklistValues.values = picklistValues.values.map(({ fullName }: { fullName: string }) => {
        const valueName = naclCase(decodeURIComponent(fullName))
        if (picklistRef.elemID.typeName === GLOBAL_VALUE_SET) {
          return new ReferenceExpression(
            picklistRef.elemID.createNestedID('customValue', ORDERED_MAP_VALUES_FIELD, valueName),
          )
        }
        if (picklistRef.elemID.typeName === STANDARD_VALUE_SET) {
          return new ReferenceExpression(
            picklistRef.elemID.createNestedID('standardValue', ORDERED_MAP_VALUES_FIELD, valueName),
          )
        }
        return new ReferenceExpression(
          picklistRef.elemID.createNestedID('valueSet', ORDERED_MAP_VALUES_FIELD, valueName),
        )
      })
    })
  },
})

export default filterCreator
