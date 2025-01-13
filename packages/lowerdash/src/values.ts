/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
