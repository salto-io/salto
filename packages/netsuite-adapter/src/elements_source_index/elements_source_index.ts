/*
*                      Copyright 2023 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import _ from 'lodash'
import { CORE_ANNOTATIONS, InstanceElement, isInstanceElement, ReadOnlyElementsSource, ElemID, Element, isObjectType, Value } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { getElementValueOrAnnotations, isCustomRecordType, isFileCabinetInstance } from '../types'
import { ElementsSourceIndexes, LazyElementsSourceIndexes, ServiceIdRecords } from './types'
import { getFieldInstanceTypes } from '../data_elements/custom_fields'
import { getElementServiceIdRecords } from '../filters/element_references'
import { CUSTOM_LIST, CUSTOM_RECORD_TYPE, INTERNAL_ID, IS_SUB_INSTANCE } from '../constants'
import { TYPES_TO_INTERNAL_ID } from '../data_elements/types'

const { awu } = collections.asynciterable
const log = logger(module)

const CUSTOM_VALUES = 'customvalues'
const CUSTOM_VALUE = 'customvalue'

export const getDataInstanceId = (internalId: string, typeNameOrId: string): string =>
  `${typeNameOrId}-${internalId}`

export const isCustomListInstance = (instance: InstanceElement): boolean =>
  instance.elemID.typeName === CUSTOM_LIST

export const getCustomListValues = (instance: InstanceElement): [Value, string][] => (
  _.isPlainObject(instance.value[CUSTOM_VALUES]?.[CUSTOM_VALUE])
    ? Object.entries(instance.value[CUSTOM_VALUES]?.[CUSTOM_VALUE])
      .map(([key, value]) => [value, key])
    : []
)

const toCustomListValueElemID = (instanceElemId: ElemID, valueKey: string): ElemID =>
  instanceElemId.createNestedID(CUSTOM_VALUES, CUSTOM_VALUE, valueKey)

export const assignToInternalIdsIndex = async (
  element: Element,
  internalIdsIndex: Record<string, ElemID>,
  elementsSource?: ReadOnlyElementsSource
): Promise<void> => {
  const values = getElementValueOrAnnotations(element)
  const internalId = values[INTERNAL_ID]
  if (!internalId || values[IS_SUB_INSTANCE]) {
    return
  }
  const { elemID } = element
  if (isObjectType(element) && isCustomRecordType(element)) {
    const customRecordTypeId = TYPES_TO_INTERNAL_ID[CUSTOM_RECORD_TYPE]
    internalIdsIndex[getDataInstanceId(internalId, CUSTOM_RECORD_TYPE)] = elemID
    internalIdsIndex[getDataInstanceId(internalId, customRecordTypeId)] = elemID
  }
  if (isInstanceElement(element)) {
    const { typeName } = elemID
    internalIdsIndex[getDataInstanceId(internalId, typeName)] = elemID
    if (typeName in TYPES_TO_INTERNAL_ID) {
      internalIdsIndex[getDataInstanceId(internalId, TYPES_TO_INTERNAL_ID[typeName])] = elemID
    }
    const type = await element.getType(elementsSource)
    if (isCustomRecordType(type) && type.annotations[INTERNAL_ID]) {
      internalIdsIndex[getDataInstanceId(internalId, type.annotations[INTERNAL_ID])] = elemID
    }
    if (isCustomListInstance(element)) {
      getCustomListValues(element)
        .filter(([value]) => value[INTERNAL_ID]).forEach(([value, key]) => {
          const valueElemId = toCustomListValueElemID(elemID, key)
          internalIdsIndex[getDataInstanceId(value[INTERNAL_ID], internalId)] = valueElemId
        })
    }
  }
}

const createIndexes = async (elementsSource: ReadOnlyElementsSource):
  Promise<ElementsSourceIndexes> => {
  const serviceIdRecordsIndex: ServiceIdRecords = {}
  const internalIdsIndex: Record<string, ElemID> = {}
  const customFieldsIndex: Record<string, InstanceElement[]> = {}
  const pathToInternalIdsIndex: Record<string, number> = {}
  const elemIdToChangeByIndex: Record<string, string> = {}
  const elemIdToChangeAtIndex: Record<string, string> = {}

  const updateInternalIdsIndex = async (element: Element): Promise<void> => {
    await assignToInternalIdsIndex(element, internalIdsIndex, elementsSource)
  }

  const updateCustomFieldsIndex = (element: InstanceElement): void => {
    getFieldInstanceTypes(element)
      .forEach(type => {
        if (!(type in customFieldsIndex)) {
          customFieldsIndex[type] = []
        }
        customFieldsIndex[type].push(element)
      })
  }

  const updatePathToInternalIdsIndex = (element: InstanceElement): void => {
    if (!isFileCabinetInstance(element)) return

    const { path, internalId } = element.value
    if (path === undefined || internalId === undefined) return

    pathToInternalIdsIndex[path] = parseInt(internalId, 10)
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

  const elements = await elementsSource.getAll()
  await awu(elements)
    .forEach(async element => {
      if (isInstanceElement(element)) {
        await updateServiceIdRecordsIndex(element)
        await updateInternalIdsIndex(element)
        updateCustomFieldsIndex(element)
        updatePathToInternalIdsIndex(element)
        updateElemIdToChangedByIndex(element)
        updateElemIdToChangedAtIndex(element)
      }
      if (isObjectType(element) && isCustomRecordType(element)) {
        await updateServiceIdRecordsIndex(element)
        await updateInternalIdsIndex(element)
        updateElemIdToChangedByIndex(element)
        updateElemIdToChangedAtIndex(element)
      }
    })

  return {
    serviceIdRecordsIndex,
    internalIdsIndex,
    customFieldsIndex,
    pathToInternalIdsIndex,
    elemIdToChangeByIndex,
    elemIdToChangeAtIndex,
  }
}

export const createElementsSourceIndex = (
  elementsSource: ReadOnlyElementsSource,
): LazyElementsSourceIndexes => {
  let cachedIndex: ElementsSourceIndexes | undefined
  return {
    getIndexes: async () => {
      if (cachedIndex === undefined) {
        cachedIndex = await log.time(() => createIndexes(elementsSource), 'createIndexes')
      }
      return cachedIndex
    },
  }
}
