/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { isDefined, isPlainRecord } from './values'

export const concatObjects = <T extends Record<string, ReadonlyArray<unknown> | unknown[] | undefined>>(
  objects: T[],
): T =>
  _.mapValues(
    _.groupBy(objects.flatMap(Object.entries), ([key]) => key),
    lists =>
      lists
        .map(([_key, list]) => list)
        .filter(isDefined)
        .flat(),
  ) as T

/*
 * Cleans empty objects recursively
 * Notice: arrays are ignored and treated like primitives
 */
export const cleanEmptyObjects = (object: Record<string, unknown>): unknown => {
  const cleanObject = (obj: unknown): unknown => {
    if (isPlainRecord(obj)) {
      const mapped = _.mapValues(obj, val => {
        const cleanedVal = cleanObject(val)
        return isPlainRecord(val) && _.isEmpty(cleanedVal) ? undefined : cleanedVal
      })
      return _.pickBy(mapped, isDefined)
    }
    return obj
  }

  const cleanedRoot = cleanObject(object)
  return isPlainRecord(cleanedRoot) && _.isEmpty(cleanedRoot) ? undefined : cleanedRoot
}
