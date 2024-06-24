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
import { awu } from '../collections/asynciterable'
import { isDefined } from '../values'

/**
 * transforms an object's values using an async mapper function
 * @returns an object whose values are the resolved results of the mapper
 */
export const mapValuesAsync = async <TVal1, TVal2>(
  o: Record<string, TVal1>,
  mapper: (val: TVal1, key: string) => Promise<TVal2>,
): Promise<Record<string, TVal2>> =>
  _.fromPairs(
    await awu(Object.entries(o))
      .map(async ([key, val]) => {
        const mappedVal = await mapper(val, key)
        return [key, mappedVal]
      })
      .toArray(),
  )

export const mapKeysAsync = async <T>(
  o: Record<string, T>,
  mapper: (val: T, key: string) => Promise<string>,
): Promise<Record<string, T>> =>
  _.fromPairs(
    await awu(Object.entries(o))
      .map(async ([key, val]) => {
        const mappedKey = await mapper(val, key)
        return [mappedKey, val]
      })
      .toArray(),
  )

/**
 * transforms an object whos values are promises
 * @returns an object
// whos values are the result of resolving the promises
 */
export const resolveValues = <TVal>(o: Record<string, Promise<TVal>>): Promise<Record<string, TVal>> =>
  mapValuesAsync(o, _.identity)

export const pickAsync = async <T>(
  o: Record<string, T>,
  pickFunc: (t: T, k: string) => Promise<unknown> | unknown,
): Promise<Record<string, T>> =>
  Object.fromEntries(
    (
      await Promise.all(
        Object.entries(o).map(async ([k, v]) => {
          if (await pickFunc(v, k)) {
            return [k, v]
          }
          return undefined
        }),
      )
    ).filter(isDefined) as [string, T][],
  )
