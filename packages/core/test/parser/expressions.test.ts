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
  ReferenceExpression, VariableExpression, TemplateExpression, ElemID,
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
  it('should evaluate strings', async () => {
    const ref = 'This must be Thursday. I never could get the hang of Thursdays.'
    const exp = await devaluate(ref, {})
    expect(await evaluate(exp, {})).toEqual(ref)
  })

  it('should evaluate maps', async () => {
    const ref = { time: 'an illusion', lunchtime: 'doubly so' }
    const exp = await devaluate(ref, {})
    expect(await evaluate(exp, {})).toEqual(ref)
  })

  it('should evaluate lists', async () => {
    const ref = [1, 2, 4, 16, 31]
    const exp = await devaluate(ref, {})
    expect(await evaluate(exp, {})).toEqual(ref)
  })

  it('should evaluate number', async () => {
    const ref = 12
    const exp = await devaluate(ref, {})
    expect(await evaluate(exp, {})).toEqual(ref)
  })

  it('should evaluate boolean', async () => {
    const ref = true
    const exp = await devaluate(ref, {})
    expect(await evaluate(exp, {})).toEqual(ref)
  })

  it('should evaluate reference', async () => {
    const ref = new ReferenceExpression(new ElemID('a', 'b', 'type'))
    const exp = await devaluate(ref, {})
    expect(await evaluate(exp, {})).toEqual(ref)
    expect(await evaluate(exp, {}) instanceof ReferenceExpression).toBe(true)
  })

  it('should evaluate variable', async () => {
    const ref = new VariableExpression(new ElemID(ElemID.VARIABLES_NAMESPACE, 'varName'))
    const exp = await devaluate(ref, {})
    expect(await evaluate(exp, {})).toEqual(ref)
    expect(await evaluate(exp, {}) instanceof VariableExpression).toBe(true)
  })

  it('should evaluate reference with invalid syntax', async () => {
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
    expect(await evaluate(exp, {})).toBeInstanceOf(IllegalReference)
  })

  it('should evaluate template reference', async () => {
    const ref = new ReferenceExpression(new ElemID('a', 'b', 'type'))
    const templ = new TemplateExpression({ parts: [ref] })
    const exp = await devaluate(templ, {})
    expect(await evaluate(exp, {})).toEqual(templ)
  })

  describe('should evaluate functions', () => {
    it('with single parameter', async () => {
      const ref = new TestFuncImpl('funcush', ['aa'])
      const exp = await devaluate(ref, functions)
      expect(await evaluate(exp, functions)).toEqual(ref)
    })
    it('with several parameters', async () => {
      const ref = new TestFuncImpl('funcush', ['aa', 312])
      const exp = await devaluate(ref, functions)
      expect(await evaluate(exp, functions)).toEqual(ref)
    })
    it('with list', async () => {
      const ref = new TestFuncImpl('funcush', [['aa', 'bb']])
      const exp = await devaluate(ref, functions)
      expect(await evaluate(exp, functions)).toEqual(ref)
    })
    it('with object', async () => {
      const ref = new TestFuncImpl('funcush', [{ aa: 'bb' }])
      const exp = await devaluate(ref, functions)
      expect(await evaluate(exp, functions)).toEqual(ref)
    })
    it('with mixed', async () => {
      const ref = new TestFuncImpl('funcush', [false, ['aa', 'bb', [1, 2, { wat: 'ZOMG' }]]])
      const exp = await devaluate(ref, functions)
      expect(await evaluate(exp, functions)).toEqual(ref)
    })
    it('nested', async () => {
      const ref = {
        nestush: new TestFuncImpl('funcush', [false, ['aa', 'bb', [1, 2, { wat: 'ZOMG' }]]]),
      }
      const exp = await devaluate(ref, functions)
      expect(await evaluate(exp, functions)).toEqual(ref)
    })
  })
})
