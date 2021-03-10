/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { INSTANCE_ANNOTATIONS, isInstanceElement, ReadOnlyElementsSource } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { getInstanceServiceIdRecords } from '../filters/instance_references'
import { serviceId } from '../transformer'
import { ElementsSourceValue, LazyElementsSourceIndex } from './types'

const log = logger(module)


const createIndex = async (elementsSource: ReadOnlyElementsSource):
  Promise<Record<string, ElementsSourceValue>> => {
  log.debug('Starting to create elements source index')
  const elementsSourceIndex: Record<string, ElementsSourceValue> = {}

  for await (const element of await elementsSource.getAll()) {
    if (isInstanceElement(element)) {
      const idRecords = getInstanceServiceIdRecords(element)
      const rawLastFetchTime = element.annotations[INSTANCE_ANNOTATIONS.LAST_FETCH_TIME]
      const lastFetchTime = rawLastFetchTime && new Date(rawLastFetchTime)

      _.assign(
        elementsSourceIndex,
        _.isEmpty(idRecords)
          ? { [serviceId(element)]: { lastFetchTime } }
          : _.mapValues(idRecords, elemID => ({ elemID, lastFetchTime }))
      )
    }
  }
  log.debug('finished creating elements source index')
  return elementsSourceIndex
}

export const createElementsSourceIndex = (
  elementsSource: ReadOnlyElementsSource,
): LazyElementsSourceIndex => {
  let cachedIndex: Record<string, ElementsSourceValue> | undefined
  return {
    getIndex: async () => {
      if (cachedIndex === undefined) {
        cachedIndex = await createIndex(elementsSource)
      }
      return cachedIndex
    },
  }
}
