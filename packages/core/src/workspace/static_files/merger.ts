/*
*                      Copyright 2020 Salto Labs Ltd.
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
import {
  Value, Values, Element, isInstanceElement,
  InstanceElement, ObjectType,
} from '@salto-io/adapter-api'
import { valuesDeepSome } from '@salto-io/adapter-utils'
import { promises } from '@salto-io/lowerdash'
import { StaticFilesSource } from './source'
import { StaticFileNaclValue } from './common'

const { object: { mapValuesAsync } } = promises

const withoutStaticFiles = (values: Values): boolean =>
  !(valuesDeepSome(values, value => value instanceof StaticFileNaclValue))

export const updateStaticFilesValuesForElements = async (
  staticFilesSource: StaticFilesSource,
  elements: Element[],
): Promise<Element[]> => {
  const enrichValue = (val: Value): Promise<Value> => {
    if (val instanceof StaticFileNaclValue) {
      return staticFilesSource.getMetaData(val)
    }
    if (_.isArray(val)) {
      return Promise.all(val.map(enrichValue))
    }
    if (_.isObject(val)) {
      return mapValuesAsync(val, enrichValue)
    }
    return Promise.resolve(val)
  }

  const enrichStaticFilesWithHashes = async (values: Values): Promise<Values> => (
    _.isArray(values)
      ? enrichValue(values)
      : mapValuesAsync(values, enrichValue)
  )

  return Promise.all(elements.map(async element => {
    if (withoutStaticFiles(element.annotations)
        && (isInstanceElement(element) && withoutStaticFiles(element.value))) {
      return element
    }

    const enrichedAnnotations = await enrichStaticFilesWithHashes(element.annotations)
    if (element instanceof ObjectType) {
      return element.clone(enrichedAnnotations)
    }
    if (isInstanceElement(element)) {
      return new InstanceElement(
        element.elemID.name,
        element.type,
        await enrichStaticFilesWithHashes(element.value),
        element.path,
        enrichedAnnotations,
      )
    }
    const clone = element.clone()
    clone.annotations = enrichedAnnotations
    return clone
  }))
}
