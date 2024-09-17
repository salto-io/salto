/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { EOL } from 'os'

export type StreamSerializer = (items: (unknown[] | Record<string, unknown>)[]) => AsyncIterable<string>

/**
 * avoid creating a single string for all items, which may exceed the max allowed string length.
 * currently only supports JSON.stringify - if cycles are possible, safeJsonStringify should be used instead.
 */
export const createStreamSerializer = ({
  maxLineLength = Infinity,
  wrapWithKey,
}: {
  maxLineLength?: number
  wrapWithKey?: string
} = {}): StreamSerializer => {
  const [start, end] =
    wrapWithKey === undefined
      ? ['[', ']']
      : // eslint-disable-next-line no-restricted-syntax
        [`{${JSON.stringify(wrapWithKey)}:[`, ']}']

  const initialLineLength = start.length + end.length

  async function* serializer(items: (unknown[] | Record<string, unknown>)[]): AsyncIterable<string> {
    let first = true
    let currentLineLength = initialLineLength

    yield start
    for (const item of items) {
      // We don't use safeJsonStringify to save some time, because we know  we made sure there aren't circles
      // eslint-disable-next-line no-restricted-syntax
      const serializedItem = JSON.stringify(item)
      if (currentLineLength + serializedItem.length + 1 > maxLineLength) {
        yield end
        yield EOL
        yield start
        first = true
        currentLineLength = initialLineLength
      }
      if (first) {
        first = false
      } else {
        yield ','
        currentLineLength += 1
      }
      yield serializedItem
      currentLineLength += serializedItem.length
    }
    yield end
  }

  return serializer
}

export const getSerializedStream = createStreamSerializer()
