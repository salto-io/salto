/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { isDefined, isPlainRecord } from './values'

export const concatObjects = <T extends Record<string, ReadonlyArray<unknown> | unknown[] | undefined>>(
  objects: T[],
  uniqueFnByKey: Record<string, (values: unknown[]) => unknown[]> = {},
): T =>
  _.mapValues(
    _.groupBy(objects.flatMap(Object.entries), ([key]) => key),
    (lists, key) => {
      const concatenated = lists
        .map(([_key, list]) => list)
        .filter(isDefined)
        .flat()

      if (uniqueFnByKey[key]) {
        return uniqueFnByKey[key](concatenated)
      }
      return concatenated
    },
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
