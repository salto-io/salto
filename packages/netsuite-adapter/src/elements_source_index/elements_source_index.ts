/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { CORE_ANNOTATIONS, InstanceElement, isInstanceElement, ReadOnlyElementsSource, TypeElement, TypeReference, ElemID, ObjectType, Element, isObjectType } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { getElementValueOrAnnotations, isCustomRecordType, isFileCabinetInstance } from '../types'
import { ElementsSourceIndexes, LazyElementsSourceIndexes, ServiceIdRecords } from './types'
import { getFieldInstanceTypes } from '../data_elements/custom_fields'
import { getElementServiceIdRecords } from '../filters/instance_references'

const { awu } = collections.asynciterable
const log = logger(module)

export const getDataInstanceId = (
  internalId: string,
  type: TypeElement | TypeReference
): string => `${type.elemID.name}-${internalId}`

const createIndexes = async (elementsSource: ReadOnlyElementsSource):
  Promise<ElementsSourceIndexes> => {
  const serviceIdRecordsIndex: ServiceIdRecords = {}
  const internalIdsIndex: Record<string, ElemID> = {}
  const customFieldsIndex: Record<string, InstanceElement[]> = {}
  const pathToInternalIdsIndex: Record<string, number> = {}
  const elemIdToChangeByIndex: Record<string, string> = {}

  const updateInternalIdsIndex = (element: InstanceElement | ObjectType): void => {
    const { internalId, isSubInstance } = getElementValueOrAnnotations(element)
    if (internalId === undefined || isSubInstance) {
      return
    }
    internalIdsIndex[getDataInstanceId(
      internalId,
      isInstanceElement(element) ? element.refType : element
    )] = element.elemID
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

  const elements = await elementsSource.getAll()
  await awu(elements)
    .forEach(async element => {
      if (isInstanceElement(element)) {
        await updateServiceIdRecordsIndex(element)
        updateInternalIdsIndex(element)
        updateCustomFieldsIndex(element)
        updatePathToInternalIdsIndex(element)
        updateElemIdToChangedByIndex(element)
      }
      if (isObjectType(element) && isCustomRecordType(element)) {
        await updateServiceIdRecordsIndex(element)
        updateInternalIdsIndex(element)
        updateElemIdToChangedByIndex(element)
      }
    })

  return {
    serviceIdRecordsIndex,
    internalIdsIndex,
    customFieldsIndex,
    pathToInternalIdsIndex,
    elemIdToChangeByIndex,
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
