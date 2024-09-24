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
  InstanceElement,
  isInstanceElement,
  ReadOnlyElementsSource,
  ElemID,
  Element,
  isObjectType,
  Value,
  ObjectType,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { getElementValueOrAnnotations, isCustomRecordType } from '../types'
import { ElementsSourceIndexes, LazyElementsSourceIndexes, ServiceIdRecords } from './types'
import { getFieldInstanceTypes } from '../data_elements/custom_fields'
import { extractCustomRecordFields, getElementServiceIdRecords } from '../filters/element_references'
import { CUSTOM_LIST, CUSTOM_RECORD_TYPE, INTERNAL_ID, IS_SUB_INSTANCE, SELECT_RECORD_TYPE } from '../constants'

const { awu } = collections.asynciterable
const log = logger(module)

const CUSTOM_VALUES = 'customvalues'
const CUSTOM_VALUE = 'customvalue'

export const getDataInstanceId = (internalId: string, typeNameOrId: string): string => `${typeNameOrId}-${internalId}`

export const isCustomListInstance = (instance: InstanceElement): boolean => instance.elemID.typeName === CUSTOM_LIST

export const getCustomListValues = (instance: InstanceElement): [Value, string][] =>
  _.isPlainObject(instance.value[CUSTOM_VALUES]?.[CUSTOM_VALUE])
    ? Object.entries(instance.value[CUSTOM_VALUES]?.[CUSTOM_VALUE]).map(([key, value]) => [value, key])
    : []

const toCustomListValueElemID = (instanceElemId: ElemID, valueKey: string): ElemID =>
  instanceElemId.createNestedID(CUSTOM_VALUES, CUSTOM_VALUE, valueKey)

export const assignToInternalIdsIndex = async (
  element: Element,
  internalIdsIndex: Record<string, ElemID>,
  typeToInternalId: Record<string, string>,
  elementsSource?: ReadOnlyElementsSource,
): Promise<void> => {
  const values = getElementValueOrAnnotations(element)
  const internalId = values[INTERNAL_ID]
  if (!internalId || values[IS_SUB_INSTANCE]) {
    return
  }
  const { elemID } = element
  if (isObjectType(element) && isCustomRecordType(element)) {
    const customRecordTypeId = typeToInternalId[CUSTOM_RECORD_TYPE]
    internalIdsIndex[getDataInstanceId(internalId, CUSTOM_RECORD_TYPE)] = elemID
    internalIdsIndex[getDataInstanceId(internalId, customRecordTypeId)] = elemID
  }
  if (isInstanceElement(element)) {
    const { typeName } = elemID
    internalIdsIndex[getDataInstanceId(internalId, typeName)] = elemID
    if (typeName in typeToInternalId) {
      internalIdsIndex[getDataInstanceId(internalId, typeToInternalId[typeName])] = elemID
    }
    const type = await element.getType(elementsSource)
    if (isCustomRecordType(type) && type.annotations[INTERNAL_ID]) {
      internalIdsIndex[getDataInstanceId(internalId, type.annotations[INTERNAL_ID])] = elemID
    }
    if (isCustomListInstance(element)) {
      getCustomListValues(element)
        .filter(([value]) => value[INTERNAL_ID])
        .forEach(([value, key]) => {
          const valueElemId = toCustomListValueElemID(elemID, key)
          internalIdsIndex[getDataInstanceId(value[INTERNAL_ID], internalId)] = valueElemId
        })
    }
  }
}

export const assignToCustomFieldsSelectRecordTypeIndex = (element: Element, index: Record<string, unknown>): void => {
  if (isInstanceElement(element) && element.value[SELECT_RECORD_TYPE] !== undefined) {
    index[element.elemID.getFullName()] = element.value[SELECT_RECORD_TYPE]
  } else if (isObjectType(element) && isCustomRecordType(element)) {
    Object.values(element.fields).forEach(field => {
      if (field.annotations[SELECT_RECORD_TYPE] !== undefined) {
        index[field.elemID.getFullName()] = field.annotations[SELECT_RECORD_TYPE]
      }
    })
  }
}

const createIndexes = async ({
  elementsSource,
  isPartial,
  typeToInternalId,
  internalIdToTypes,
  deletedElements,
}: {
  elementsSource: ReadOnlyElementsSource
  isPartial: boolean
  typeToInternalId: Record<string, string>
  internalIdToTypes: Record<string, string[]>
  deletedElements: ElemID[]
}): Promise<ElementsSourceIndexes> => {
  const serviceIdRecordsIndex: ServiceIdRecords = {}
  const internalIdsIndex: Record<string, ElemID> = {}
  const customFieldsIndex: Record<string, InstanceElement[]> = {}
  const elemIdToChangeByIndex: Record<string, string> = {}
  const elemIdToChangeAtIndex: Record<string, string> = {}
  const customRecordFieldsServiceIdRecordsIndex: ServiceIdRecords = {}
  const customFieldsSelectRecordTypeIndex: Record<string, unknown> = {}

  const updateInternalIdsIndex = async (element: Element): Promise<void> => {
    await assignToInternalIdsIndex(element, internalIdsIndex, typeToInternalId, elementsSource)
  }

  const updateCustomFieldsIndex = (element: InstanceElement): void => {
    getFieldInstanceTypes(element, internalIdToTypes).forEach(type => {
      if (!(type in customFieldsIndex)) {
        customFieldsIndex[type] = []
      }
      customFieldsIndex[type].push(element)
    })
  }

  const updateElemIdToChangedByIndex = (element: Element): void => {
    const changeBy = element.annotations[CORE_ANNOTATIONS.CHANGED_BY]
    if (changeBy !== undefined) {
      elemIdToChangeByIndex[element.elemID.getFullName()] = changeBy
    }
  }

  const updateServiceIdRecordsIndex = async (element: Element): Promise<void> => {
    const serviceIdRecords = await getElementServiceIdRecords(element, elementsSource)
    _.assign(serviceIdRecordsIndex, serviceIdRecords)
  }

  const updateElemIdToChangedAtIndex = (element: Element): void => {
    const changeAt = element.annotations[CORE_ANNOTATIONS.CHANGED_AT]
    if (changeAt !== undefined) {
      elemIdToChangeAtIndex[element.elemID.getFullName()] = changeAt
    }
  }

  const updateCustomRecordFieldsIndex = (customObjectType: ObjectType): void => {
    const serviceIdRecords = _.keyBy(extractCustomRecordFields(customObjectType), 'serviceID')
    _.assign(customRecordFieldsServiceIdRecordsIndex, serviceIdRecords)
  }

  const updateCustomFieldsSelectRecordTypeIndex = (element: Element): void => {
    assignToCustomFieldsSelectRecordTypeIndex(element, customFieldsSelectRecordTypeIndex)
  }

  const deletedElementSet = new Set(deletedElements.map(elemId => elemId.getFullName()))
  const elements = await elementsSource.getAll()
  await awu(elements)
    // avoid creating reference to a deleted element
    .filter(element => !deletedElementSet.has(element.elemID.getFullName()))
    .filter(element => isInstanceElement(element) || (isObjectType(element) && isCustomRecordType(element)))
    .forEach(async element => {
      updateElemIdToChangedByIndex(element)
      updateElemIdToChangedAtIndex(element)
      if (isPartial) {
        await updateServiceIdRecordsIndex(element)
        await updateInternalIdsIndex(element)
        updateCustomFieldsSelectRecordTypeIndex(element)
        if (isInstanceElement(element)) {
          updateCustomFieldsIndex(element)
        } else if (isObjectType(element) && isCustomRecordType(element)) {
          updateCustomRecordFieldsIndex(element)
        }
      }
    })

  return {
    serviceIdRecordsIndex,
    internalIdsIndex,
    customFieldsIndex,
    elemIdToChangeByIndex,
    elemIdToChangeAtIndex,
    customRecordFieldsServiceIdRecordsIndex,
    customFieldsSelectRecordTypeIndex,
  }
}

export const createElementsSourceIndex = ({
  elementsSource,
  isPartial,
  typeToInternalId,
  internalIdToTypes,
  deletedElements = [],
}: {
  elementsSource: ReadOnlyElementsSource
  isPartial: boolean
  typeToInternalId: Record<string, string>
  internalIdToTypes: Record<string, string[]>
  deletedElements?: ElemID[]
}): LazyElementsSourceIndexes => {
  let cachedIndex: ElementsSourceIndexes | undefined
  return {
    getIndexes: async () => {
      if (cachedIndex === undefined) {
        cachedIndex = await log.timeDebug(
          () => createIndexes({ elementsSource, isPartial, typeToInternalId, internalIdToTypes, deletedElements }),
          'createIndexes',
        )
      }
      return cachedIndex
    },
  }
}
