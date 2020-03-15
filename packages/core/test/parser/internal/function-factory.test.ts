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
  StaticFileAsset,
} from '@salto-io/adapter-api'
import {
  TestFuncImpl,
} from '@salto-io/adapter-utils'
import {
  hasFunction,
  functionFactory,
  registerFunctionValue,
  resetFunctions,
} from '../../../src/parser/internal/functions/factory'
import { HclExpression, SourcePos } from '../../../src/parser/internal/types'

const sourcePos: SourcePos = {
  line: 42,
  col: 42,
  byte: 42,
}

describe('Function factory', () => {
  describe('hasFunction', () => {
    it('should find the file function', () =>
      expect(hasFunction('file')).toEqual(true))
    it('should not find missing function', () =>
      expect(hasFunction('zomg')).toEqual(false))
  })

  describe('Factory', () => {
    it('should initiate file function', () => {
      const hclFunc: HclExpression = {
        type: 'func',
        expressions: [],
        value: {
          parameters: ['some/path.ext'],
          funcName: 'file',
        },
        source: {
          filename: 'ZOMG',
          start: sourcePos,
          end: sourcePos,
        },
      }
      const fileFunc = functionFactory(hclFunc)
      expect(fileFunc instanceof StaticFileAsset).toEqual(true)
      expect(fileFunc).toHaveProperty('relativeFileName', 'some/path.ext')
    })
    it('should fail if missing function', () => {
      const hclFunc: HclExpression = {
        type: 'func',
        expressions: [],
        value: {
          parameters: ['arg', 'us'],
          funcName: 'ZOMG',
        },
        source: {
          start: sourcePos,
          end: sourcePos,
          filename: 'ZOMG',
        },
      }

      expect(() => functionFactory(hclFunc)).toThrow(new Error('Invalid function name \'ZOMG\''))
    })
  })
  describe('register functions', () => {
    beforeEach(() => resetFunctions(['w00t', 'zOMG']))

    it('should register function for single alias', () => {
      expect(hasFunction('w00t')).toEqual(false)
      registerFunctionValue<TestFuncImpl>(['w00t'], (
        funcExp: HclExpression
      ) => new TestFuncImpl('w00t', funcExp.value.parameters))

      expect(hasFunction('w00t')).toEqual(true)
      const hclFunc: HclExpression = {
        type: 'func',
        expressions: [],
        value: {
          parameters: ['arg', 'us'],
          funcName: 'w00t',
        },
        source: {
          start: sourcePos,
          end: sourcePos,
          filename: 'ZOMG',
        },
      }

      const func = functionFactory(hclFunc)

      expect(func instanceof TestFuncImpl).toEqual(true)
    })

    it('should register function for multiple aliases', () => {
      expect(hasFunction('w00t')).toEqual(false)
      expect(hasFunction('zOMG')).toEqual(false)
      registerFunctionValue<TestFuncImpl>(['w00t', 'zOMG'], (
        funcExp: HclExpression
      ) => new TestFuncImpl('w00t', funcExp.value.parameters))

      expect(hasFunction('w00t')).toEqual(true)
      expect(hasFunction('zOMG')).toEqual(true)
    })
  })
})
