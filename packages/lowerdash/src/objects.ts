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
import { isDefined } from './values'

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const cleanEmptyObjects = (object: any): any | undefined => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cleanObject = (obj: any): any => {
    if (Array.isArray(obj)) {
      return obj.filter(item => !_.isEmpty(item)).map(item => cleanObject(item))
    }
    if (_.isPlainObject(obj)) {
      const mapped = _.mapValues(obj, val => _.isEmpty(val) ? undefined : cleanObject(val))
      return _.omitBy(mapped, _.isEmpty)
    }
    return obj
  }

  const cleanedRoot = cleanObject(object)
  return _.isEmpty(cleanedRoot) ? undefined : cleanedRoot
}