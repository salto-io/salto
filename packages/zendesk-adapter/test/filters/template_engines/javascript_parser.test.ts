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
import { parsePotentialReferencesByPrefix } from '../../../src/filters/template_engines/javascript_parser'

describe('parsePotentialReferencesByPrefix', () => {
  it('should return an array of initial assignments to variable definitions with the given prefix', () => {
    const code = `
        const myVar1 = "hello";
        let myVar2 = "world";
        const otherVar = "test";
      `
    const prefix = 'myVar'
    const result = parsePotentialReferencesByPrefix(code, prefix)
    expect(result).toEqual(['hello', 'world'])
  })

  it('should return an empty array if no variables or assignments with the given prefix are found', () => {
    const code = `
        const otherVar1 = "hello";
        let otherVar2 = "world";
        const anotherVar = "test";
      `
    const prefix = 'myVar'
    const result = parsePotentialReferencesByPrefix(code, prefix)
    expect(result).toEqual([])
  })

  it('should find literal selectors in jQuery-like expressions', () => {
    const code = `
      $('goodbye').addClass('myClass');
      const myVar3 = $('space_123').text();
      $(myVar3).val()
    `
    const prefix = 'notRelevantHere'
    const result = parsePotentialReferencesByPrefix(code, prefix)
    expect(result).toEqual(['goodbye', 'space_123'])
  })
})
