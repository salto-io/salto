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
