/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { SourceLocation } from '@handlebars/parser/types/ast'
import { ElemID, InstanceElement, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import {
  extractIdIfElementExists,
  findLineStartIndexes,
  sourceLocationToIndexRange,
} from '../../../src/filters/template_engines/utils'

describe('findLineStartIndexes', () => {
  it('should return the start indexes of each line in the input', () => {
    expect(findLineStartIndexes('a\nb\nc')).toEqual([0, 2, 4])
    expect(findLineStartIndexes('a\nb\nc\n')).toEqual([0, 2, 4])
    expect(findLineStartIndexes('\n')).toEqual([0])
    expect(findLineStartIndexes('')).toEqual([0])
  })
})

describe('sourceLocationToIndexRange', () => {
  it('should convert a Handlebar location to a range of indexes in a string', () => {
    const newlineIndexes = [0, 2, 4, 5]
    const loc = { start: { line: 2, column: 1 }, end: { line: 3, column: 1 } } as SourceLocation
    expect(sourceLocationToIndexRange(newlineIndexes, loc)).toEqual({ start: 3, end: 5 })
  })
})

describe('extractIdIfElementExists', () => {
  it('should return a reference expression if the element exists', () => {
    const element = new InstanceElement('elem', new ObjectType({ elemID: new ElemID('', 'test') }))
    const idsToElements = { elem: element }
    expect(extractIdIfElementExists(idsToElements, 'elem')).toEqual(new ReferenceExpression(element.elemID, element))
  })

  it('should return the id if the element does not exist', () => {
    const idsToElements = {}
    expect(extractIdIfElementExists(idsToElements, 'elem')).toEqual('elem')
  })
})
