/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { ReferenceExpression, TemplateExpression, ElemID } from 'adapter-api'
import devaluate from './internal/devaluate'
import evaluate from '../../src/parser/expressions'

describe('HCL Expression', () => {
  it('should evaluate strings', () => {
    const ref = 'This must be Thursday. I never could get the hang of Thursdays.'
    const exp = devaluate(ref)
    expect(evaluate(exp)).toEqual(ref)
  })

  it('should evaluate maps', () => {
    const ref = { time: 'an illusion', lunchtime: 'doubly so' }
    const exp = devaluate(ref)
    expect(evaluate(exp)).toEqual(ref)
  })

  it('should evaluate lists', () => {
    const ref = [1, 2, 4, 16, 31]
    const exp = devaluate(ref)
    expect(evaluate(exp)).toEqual(ref)
  })

  it('should evaluate number', () => {
    const ref = 12
    const exp = devaluate(ref)
    expect(evaluate(exp)).toEqual(ref)
  })

  it('should evaluate boolean', () => {
    const ref = true
    const exp = devaluate(ref)
    expect(evaluate(exp)).toEqual(ref)
  })

  it('should evaluate reference', () => {
    const ref = new ReferenceExpression(new ElemID('a', 'b', 'type'))
    const exp = devaluate(ref)
    expect(evaluate(exp)).toEqual(ref)
  })

  it('should evaluate template reference', () => {
    const ref = new ReferenceExpression(new ElemID('a', 'b', 'type'))
    const templ = new TemplateExpression({ parts: [ref] })
    const exp = devaluate(templ)
    expect(evaluate(exp)).toEqual(templ)
  })
})
