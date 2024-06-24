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
import { ElemID, InstanceElement, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import { ZENDESK, ARTICLE_TYPE_NAME } from '../../../src/constants'
import { parsePotentialReferencesByPrefix } from '../../../src/filters/template_engines/javascript_parser'

describe('parsePotentialReferencesByPrefix', () => {
  it('should return an array of initial assignments to variable definitions with the given prefix', () => {
    const code = `
        const myVar1 = "hello";
        let myVar2 = 1234567;
        const myVarArray = [1, 2, 3];
        const otherVar = "test";
      `
    const prefix = 'myVar'
    const result = parsePotentialReferencesByPrefix(code, {}, prefix)
    expect(result).toEqual([
      {
        loc: { start: 24, end: 31 },
        value: { parts: ['"hello"'] },
      },
      {
        loc: { start: 54, end: 61 },
        value: { parts: ['1234567'] },
      },
      {
        loc: { start: 91, end: 92 },
        value: { parts: ['1'] },
      },
      {
        loc: { start: 94, end: 95 },
        value: { parts: ['2'] },
      },
      {
        loc: { start: 97, end: 98 },
        value: { parts: ['3'] },
      },
    ])
  })

  it('should return an empty array if no variables or assignments with the given prefix are found', () => {
    const code = `
        const otherVar1 = "hello";
        let otherVar2 = "world";
        const anotherVar = "test";
      `
    const prefix = 'myVar'
    const result = parsePotentialReferencesByPrefix(code, {}, prefix)
    expect(result).toEqual([])
  })

  it('should find literal selectors in jQuery-like expressions', () => {
    const code = `
      $('goodbye').addClass('myClass');
      const myVar3 = $('space_123').text();
      $(myVar3).val()
    `
    const prefix = 'notRelevantHere'
    const result = parsePotentialReferencesByPrefix(code, {}, prefix)
    expect(result).toEqual([
      {
        loc: { start: 9, end: 18 },
        value: { parts: ["'goodbye'"] },
      },
      {
        loc: { start: 64, end: 75 },
        value: { parts: ["'space_123'"] },
      },
    ])
  })

  it('should replace ids with referenceExpressions if they exist in idsToElements', () => {
    const code = `
      const prefix_my_id = 'catch_1144225_miss_1144226';
      $('catch_1144225_miss_1144226').val()
    `

    const article = new InstanceElement('article', new ObjectType({ elemID: new ElemID(ZENDESK, ARTICLE_TYPE_NAME) }))
    const prefix = 'prefix'
    const result = parsePotentialReferencesByPrefix(
      code,
      {
        1144225: article,
      },
      prefix,
    )
    expect(result).toEqual([
      {
        loc: { start: 28, end: 56 },
        value: { parts: ["'catch_", new ReferenceExpression(article.elemID, article), "_miss_1144226'"] },
      },
      {
        loc: { start: 66, end: 94 },
        value: { parts: ["'catch_", new ReferenceExpression(article.elemID, article), "_miss_1144226'"] },
      },
    ])
  })

  it('returns an empty array if there were parse errors', () => {
    const code = `
      const myVar = 'hello missing end quote;
    `
    const prefix = 'myVar'
    const result = parsePotentialReferencesByPrefix(code, {}, prefix)
    expect(result).toEqual([])
  })
})
