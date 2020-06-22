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
import { Value } from '@salto-io/adapter-api'
import {
  evaluateFunction,
  Functions,
  FunctionImplementation,
  MissingFunctionError,
  FunctionExpression,
} from '../../src/parser/functions'

export class TestFuncImpl {
  constructor(
    public readonly funcName: string,
    public readonly parameters: Value[],
  ) {
  }
}

const registerFunction = (
  funcName: string,
  func: FunctionImplementation,
  functions: Functions = {},
  aliases: string[] = [],
): Functions => ({
  ...functions,
  ...[funcName].concat(aliases).reduce((acc, alias: string) => ({
    ...acc,
    ...{
      [alias]: func,
    },
  }), {}),
})

export const registerTestFunction = (
  funcName: string,
  aliases: string[] = [],
  functions: Functions = {}
): Functions =>
  registerFunction(
    funcName,
    {
      parse: (parameters: Value[]) => Promise.resolve(new TestFuncImpl(funcName, parameters)),
      dump: (val: Value) => Promise.resolve(new FunctionExpression(
        funcName,
        val.parameters,
      )),
      isSerializedAsFunction: (val: Value) => val instanceof TestFuncImpl,
    },
    functions,
    aliases,
  )

describe('Functions', () => {
  describe('MissingFunctionError', () => {
    it('should show correct message and severity', () => {
      const missus = new MissingFunctionError('ZOMG')
      expect(missus.message).toEqual('Invalid function name \'ZOMG\'')
      expect(missus.severity).toEqual('Error')
      expect(missus.toString()).toEqual(missus.message)
    })
  })
  describe('Factory', () => {
    it('should fail if missing function with default parameters', async () => {
      expect(await evaluateFunction('ZOMG', ['arg', 'us'], {})).toEqual(new MissingFunctionError('ZOMG'))
    })
    it('should fail if missing function with explicit parameters', async () => {
      expect(await evaluateFunction('ZOMG', ['arg', 'us'], {})).toEqual(new MissingFunctionError('ZOMG'))
    })
  })
})
