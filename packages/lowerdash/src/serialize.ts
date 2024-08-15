/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

/**
 * avoid creating a single string for all items, which may exceed the max allowed string length.
 * currently only supports JSON.stringify - if cycles are possible, safeJsonStringify should be used instead.
 */
export async function* getSerializedStream(items: (unknown[] | Record<string, unknown>)[]): AsyncIterable<string> {
  let first = true
  yield '['
  for (const item of items) {
    if (first) {
      first = false
    } else {
      yield ','
    }
    // We don't use safeJsonStringify to save some time, because we know  we made sure there aren't
    // circles
    // eslint-disable-next-line no-restricted-syntax
    yield JSON.stringify(item)
  }
  yield ']'
}
