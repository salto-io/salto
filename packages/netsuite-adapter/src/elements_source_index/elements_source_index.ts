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
import { CORE_ANNOTATIONS, InstanceElement, isInstanceElement, ReadOnlyElementsSource, TypeElement, TypeReference } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { LAST_FETCH_TIME } from '../constants'
import { isFileCabinetInstance } from '../types'
import { getInstanceServiceIdRecords } from '../filters/instance_references'
import { ElementsSourceIndexes, ElementsSourceValue, LazyElementsSourceIndexes, ServiceIdRecords } from './types'
import { getServiceId } from '../transformer'
import { getFieldInstanceTypes } from '../data_elements/custom_fields'

const { awu } = collections.asynciterable
const log = logger(module)

export const getDataInstanceId = (
  internalId: string,
  type: TypeElement | TypeReference
): string => `${type.elemID.name}-${internalId}`

const createIndexes = async (elementsSource: ReadOnlyElementsSource):
  Promise<ElementsSourceIndexes> => {
  const serviceIdsIndex: Record<string, ElementsSourceValue> = {}
  const serviceIdRecordsIndex: ServiceIdRecords = {}
  const internalIdsIndex: Record<string, ElementsSourceValue> = {}
  const customFieldsIndex: Record<string, InstanceElement[]> = {}
  const pathToInternalIdsIndex: Record<string, number> = {}
  const elemIdToChangeByIndex: Record<string, string> = {}

  const updateServiceIdIndex = async (element: InstanceElement): Promise<void> => {
    const serviceIdRecords = await getInstanceServiceIdRecords(element, elementsSource)
    _.assign(serviceIdRecordsIndex, serviceIdRecords)

    const rawLastFetchTime = element.value[LAST_FETCH_TIME]
    const lastFetchTime = rawLastFetchTime && new Date(rawLastFetchTime)

    _.assign(
      serviceIdsIndex,
      _.isEmpty(serviceIdRecords)
        ? { [getServiceId(element)]: { lastFetchTime } }
        : _.mapValues(serviceIdRecords, ({ elemID }) => ({ elemID, lastFetchTime }))
    )
  }

  const updateInternalIdsIndex = (element: InstanceElement): void => {
    const { internalId, isSubInstance } = element.value
    if (internalId === undefined || isSubInstance) {
      return
    }

    const rawLastFetchTime = element.value[LAST_FETCH_TIME]
    const lastFetchTime = rawLastFetchTime && new Date(rawLastFetchTime)

    internalIdsIndex[getDataInstanceId(internalId, element.refType)] = {
      elemID: element.elemID,
      lastFetchTime,
    }
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

  const updateElemIdToChangedByIndex = (element: InstanceElement): void => {
    const changeBy = element.annotations[CORE_ANNOTATIONS.CHANGED_BY]
    if (changeBy !== undefined) {
      elemIdToChangeByIndex[element.elemID.getFullName()] = changeBy
    }
  }

  await awu(await elementsSource.getAll())
    .filter(isInstanceElement)
    .forEach(async element => {
      await updateServiceIdIndex(element)
      updateInternalIdsIndex(element)
      updateCustomFieldsIndex(element)
      updatePathToInternalIdsIndex(element)
      updateElemIdToChangedByIndex(element)
    })

  return {
    serviceIdsIndex,
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
