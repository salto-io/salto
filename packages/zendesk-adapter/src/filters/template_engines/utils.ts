/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { SourceLocation as HandlebarLocation } from '@handlebars/parser/types/ast'
import { InstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import { SourceLocation as AcornLocation } from 'acorn'

export const findLineStartIndexes = (input: string, pos = 0, indexes = [0]): number[] => {
  const index = input.indexOf('\n', pos)
  if (index === -1) {
    // If the last character is a newline, remove the last wrong start index
    if (input.endsWith('\n')) {
      indexes.pop() // Removes the last element
    }
    return indexes
  }
  return findLineStartIndexes(input, index + 1, [...indexes, index + 1])
}

export const sourceLocationToIndexRange = (
  newlineIndexes: number[],
  loc: HandlebarLocation | AcornLocation,
): { start: number; end: number } => {
  const start = newlineIndexes[loc.start.line - 1] + loc.start.column
  const end = newlineIndexes[loc.end.line - 1] + loc.end.column
  return { start, end }
}

export const extractIdIfElementExists = (
  idsToElements: Record<string, InstanceElement>,
  id: string,
): string | ReferenceExpression => {
  const element = idsToElements[id]
  if (element !== undefined) {
    return new ReferenceExpression(element.elemID, element)
  }
  return id
}
