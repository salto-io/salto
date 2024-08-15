/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
