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

export const makeArray = <TIn>(input: TIn | TIn[] | undefined): TIn[] => {
  if (input === undefined) {
    return []
  }
  return Array.isArray(input) ? input : [input]
}

export function arrayOf(n: number): undefined[]
export function arrayOf<T>(n: number, initializer?: (i: number) => T): T[]
export function arrayOf<T>(n: number, initializer?: (i: number) => T): T[] | unknown[] {
  const ar = Array.from({ length: n })
  return initializer !== undefined ? ar.map((_v, i) => initializer(i)) : ar
}

export const findDuplicates = (items: string[]): string[] =>
  Object.entries(_.countBy(items))
    .filter(([_str, count]) => count > 1)
    .map(([str]) => str)
    .sort()

export const splitDuplicates = <T>(
  array: T[],
  keyFunc: (t: T) => string | number,
): { duplicates: T[][]; uniques: T[] } => {
  const groupedInput = Object.values(_.groupBy(array, keyFunc))
  const [duplicates, uniques] = _.partition(groupedInput, group => group.length > 1)
  return { duplicates, uniques: uniques.flat() }
}
