/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  Element,
  ElemID,
  Field,
  InstanceElement,
  isField,
  isInstanceElement,
  isObjectType,
  isReferenceExpression,
  ObjectType,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { getParents, inspectValue } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { GLOBAL_VALUE_SET } from './global_value_sets'
import { STANDARD_VALUE_SET } from './standard_value_sets'
import { apiNameSync, buildElementsSourceForFetch, isInstanceOfTypeSync, metadataTypeSync } from './utils'
import {
  BUSINESS_PROCESS_METADATA_TYPE,
  FIELD_ANNOTATIONS,
  RECORD_TYPE_METADATA_TYPE,
  SALESFORCE,
  VALUE_SET_FIELDS,
} from '../constants'
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

const safeDecodeURIComponent = (encoded: string): string => {
  try {
    return decodeURIComponent(encoded)
  } catch (e: unknown) {
    log.warn('Failed to decode URI component: %s', e)
    return encoded
  }
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
        // Using URI decode since RecordType Picklist values return as encoded URI string.
        // e.g. 'You %26 Me' instead of 'You & Me'.
        picklistValuesReferenceIndex[valueSetElement.elemID.getFullName()]?.[safeDecodeURIComponent(value.fullName)]
      if (ref) {
        _.set(value, 'fullName', ref)
      } else {
        log.trace('Failed to resolve picklist value %s in field %s', value.fullName, field.elemID.getFullName())
      }
    })
  })
}

// Create reference index from baseElements full names (either Field, GlobalValueSet or StandardValueSet instances)
// with references to each of their valueSet values.
const createPicklistValuesReferenceIndex = (elements: Element[]): PicklistValuesReferenceIndex => {
  const createRefIndexForElement = (
    element: InstanceElement | Field,
  ): Record<string, ReferenceExpression> | undefined => {
    const fieldName = getValueSetFieldName(metadataTypeSync(element))
    const values = isInstanceElement(element) ? element.value[fieldName] : element.annotations[fieldName]
    if (!isOrderedValueSet(values)) {
      return undefined
    }
    return Object.entries(values.values).reduce<Record<string, ReferenceExpression>>((acc, [key, value]) => {
      const fullName = _.isString(value.fullName) ? value.fullName : apiNameSync(value.fullName.value) ?? ''
      acc[fullName] = new ReferenceExpression(
        element.elemID.createNestedID(fieldName, ORDERED_MAP_VALUES_FIELD, key, 'fullName'),
        fullName,
      )
      return acc
    }, {})
  }
  const instances: (InstanceElement | Field)[] = elements.filter(
    isInstanceOfTypeSync(STANDARD_VALUE_SET, GLOBAL_VALUE_SET),
  )
  const picklistFields = elements
    .filter(isObjectType)
    .flatMap(obj => Object.values(obj.fields))
    .filter(field => field.annotations[FIELD_ANNOTATIONS.VALUE_SET] !== undefined)
  return instances.concat(picklistFields).reduce<PicklistValuesReferenceIndex>((acc, element) => {
    const elementRefIndex = createRefIndexForElement(element)
    if (elementRefIndex) {
      acc[element.elemID.getFullName()] = elementRefIndex
    }
    return acc
  }, {})
}

export const BUSINESS_PROCESS_PARENTS = ['Lead', 'Opportunity', 'Case'] as const
export type BusinessProcessParent = (typeof BUSINESS_PROCESS_PARENTS)[number]

const isBusinessProcessParent = (parentName: string): parentName is BusinessProcessParent =>
  BUSINESS_PROCESS_PARENTS.includes(parentName as BusinessProcessParent)

const businessProcessParentToValueSetElemID: Record<BusinessProcessParent, string> = {
  Lead: new ElemID(SALESFORCE, STANDARD_VALUE_SET, 'instance', 'LeadStatus').getFullName(),
  Opportunity: new ElemID(SALESFORCE, STANDARD_VALUE_SET, 'instance', 'OpportunityStage').getFullName(),
  Case: new ElemID(SALESFORCE, STANDARD_VALUE_SET, 'instance', 'CaseStatus').getFullName(),
}

type BusinessProcessPicklistValues = {
  fullName: string
}[]

const isBusinessProcessPicklistValues = (value: unknown): value is BusinessProcessPicklistValues =>
  _.isArray(value) && value.every(v => _.isObject(v) && _.isString(_.get(v, 'fullName')))

const isObjectTypeRef = (ref: ReferenceExpression): ref is ReferenceExpression<ObjectType> =>
  isReferenceExpression(ref) && isObjectType(ref.value)

const createReferencesForBusinessProcess = ({
  instance,
  picklistValuesReferenceIndex,
  nonHandledParents,
}: {
  instance: InstanceElement
  picklistValuesReferenceIndex: PicklistValuesReferenceIndex
  nonHandledParents: Set<string>
}): void => {
  const [parentRef] = getParents(instance)
  if (!isObjectTypeRef(parentRef)) {
    return
  }
  const parentName = apiNameSync(parentRef.value) ?? ''
  if (!isBusinessProcessParent(parentName)) {
    nonHandledParents.add(parentName)
    return
  }
  const valueSetElemID = businessProcessParentToValueSetElemID[parentName]
  const { values } = instance.value
  if (!isBusinessProcessPicklistValues(values)) {
    return
  }
  values.forEach(value => {
    const ref: ReferenceExpression | undefined =
      picklistValuesReferenceIndex[valueSetElemID]?.[safeDecodeURIComponent(value.fullName)]
    if (ref) {
      _.set(value, 'fullName', ref)
    }
  })
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
    const nonHandledParents = new Set<string>()
    elements
      .filter(isInstanceOfTypeSync(BUSINESS_PROCESS_METADATA_TYPE))
      .forEach(instance =>
        createReferencesForBusinessProcess({ instance, picklistValuesReferenceIndex, nonHandledParents }),
      )
    if (nonHandledParents.size > 0) {
      log.trace(
        'Failed to resolve picklist values for the following business process parents: %s',
        inspectValue(nonHandledParents),
      )
    }
  },
})

export default filterCreator
