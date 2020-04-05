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
import {
  ReferenceExpression, TemplateExpression,
  ElemID, StaticFile,
} from '@salto-io/adapter-api'
import {
  Functions,
} from '../../src/parser/functions'
import devaluate from './internal/devaluate'
import evaluate, { IllegalReference } from '../../src/parser/expressions'
import { HclExpression } from '../../src/parser/internal/types'
import {
  TestFuncImpl,
  registerTestFunction,
} from './functions.test'


const funcName = 'funcush'
let functions: Functions

beforeAll(() => {
  functions = registerTestFunction(funcName)
})

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

  it('should evaluate reference with invalid syntax', () => {
    const exp: HclExpression = {
      type: 'reference',
      value: ['salto', 'foo', 'inst'],
      expressions: [],
      source: {
        filename: 'dummy',
        start: { line: 0, col: 0, byte: 0 },
        end: { line: 0, col: 0, byte: 0 },
      },
    }
    expect(evaluate(exp)).toBeInstanceOf(IllegalReference)
  })

  it('should evaluate template reference', () => {
    const ref = new ReferenceExpression(new ElemID('a', 'b', 'type'))
    const templ = new TemplateExpression({ parts: [ref] })
    const exp = devaluate(templ)
    expect(evaluate(exp)).toEqual(templ)
  })

  describe('should evaluate functions', () => {
    it('with single parameter', () => {
      const ref = new TestFuncImpl('funcush', ['aa'])
      const exp = devaluate(ref)
      expect(evaluate(exp, undefined, undefined, functions)).toEqual(ref)
    })
    it('with several parameters', () => {
      const ref = new TestFuncImpl('funcush', ['aa', 312])
      const exp = devaluate(ref)
      expect(evaluate(exp, undefined, undefined, functions)).toEqual(ref)
    })
    it('with list', () => {
      const ref = new TestFuncImpl('funcush', [['aa', 'bb']])
      const exp = devaluate(ref)
      expect(evaluate(exp, undefined, undefined, functions)).toEqual(ref)
    })
    it('with object', () => {
      const ref = new TestFuncImpl('funcush', [{ aa: 'bb' }])
      const exp = devaluate(ref)
      expect(evaluate(exp, undefined, undefined, functions)).toEqual(ref)
    })
    it('with mixed', () => {
      const ref = new TestFuncImpl('funcush', [false, ['aa', 'bb', [1, 2, { wat: 'ZOMG' }]]])
      const exp = devaluate(ref)
      expect(evaluate(exp, undefined, undefined, functions)).toEqual(ref)
    })
    it('file function', () => {
      const exp: HclExpression = {
        type: 'func',
        value: {
          funcName: 'file',
          parameters: [devaluate('aaasome/path.ext')],
        },
        expressions: [],
        source: {
          filename: 'dummy',
          start: { line: 0, col: 0, byte: 0 },
          end: { line: 0, col: 0, byte: 0 },
        },
      }
      expect(evaluate(exp)).toEqual(new StaticFile('dummy', 'aaasome/path.ext'))
    })
    it('nested', () => {
      const ref = {
        nestush: new TestFuncImpl('funcush', [false, ['aa', 'bb', [1, 2, { wat: 'ZOMG' }]]]),
      }
      const exp = devaluate(ref)
      expect(evaluate(exp, undefined, undefined, functions)).toEqual(ref)
    })
  })
})
