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

export const isDefined = <T>(val: T | undefined | void): val is T => val !== undefined

export const isPlainObject = (val: unknown): val is object => _.isPlainObject(val)
export const isPlainRecord = (val: unknown): val is Record<string, unknown> => _.isPlainObject(val)

export const lookupValue = (blob: unknown, lookupFunc: (val: unknown) => boolean | void): boolean => {
  if (lookupFunc(blob)) {
    return true
  }
  if (_.isArray(blob)) {
    return blob.some(item => lookupValue(item, lookupFunc))
  }
  if (isPlainRecord(blob)) {
    return Object.values(blob).some(item => lookupValue(item, lookupFunc))
  }
  return false
}

// _.isEqual has terrible performance for sets, prefer this when possible
export const setsEqual = <T>(a: Set<T>, b: Set<T>): boolean => a.size === b.size && [...a].every(x => b.has(x))
