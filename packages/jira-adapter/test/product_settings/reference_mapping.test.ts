/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { JiraFieldReferenceResolver, resolutionAndPriorityToTypeName } from '../../src/reference_mapping'

describe('resolutionAndPriorityToTypeName', () => {
  let inputString: string
  describe('Priority and Resolution', () => {
    it('should return "Priority"', () => {
      inputString = 'priority'
      expect(resolutionAndPriorityToTypeName(inputString)).toEqual('Priority')
    })
    it('should return "Resolution"', () => {
      inputString = 'resolution'
      expect(resolutionAndPriorityToTypeName(inputString)).toEqual('Resolution')
    })
  })
  describe('any other input', () => {
    it('should return undefined', () => {
      inputString = ''
      expect(resolutionAndPriorityToTypeName(inputString)).toBeUndefined()
      inputString = 'assignee'
      expect(resolutionAndPriorityToTypeName(inputString)).toBeUndefined()
      inputString = 'customfield_10003'
      expect(resolutionAndPriorityToTypeName(inputString)).toBeUndefined()
    })
  })
})
describe('JiraFieldReferenceResolver', () => {
  it('should use fall back when there is no serializationStrategy ', () => {
    const res = new JiraFieldReferenceResolver({
      src: { field: 'value', parentTypes: ['WorkflowProperty'] },
      target: { typeContext: 'workflowStatusPropertiesContext' },
    })
    expect(res.serializationStrategy).toBeDefined()
  })
  it('should use the correct sourceTransformation ', () => {
    const res = new JiraFieldReferenceResolver({
      src: { field: 'value', parentTypes: ['WorkflowProperty'] },
      sourceTransformation: 'asCaseInsensitiveString',
      target: { typeContext: 'workflowStatusPropertiesContext' },
    })
    expect(res.sourceTransformation).toBeDefined()
    expect(res.sourceTransformation.transform('AAA')).toEqual('aaa')
    expect(res.sourceTransformation.validate('blah', 'BLAH')).toBeTrue()
  })
})
