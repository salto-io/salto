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
  Value,
  SaltoError,
  SaltoErrorSeverity,
} from '@salto-io/adapter-api'
import { StaticFileNaclValue } from '../workspace/static_files/common'
import { HclExpression } from './internal/types'
import { FunctionExpression } from './internal/functions'

export type FunctionImplementation = {
 toValue(funcExp: HclExpression): Promise<Value>
 fromValue(val: Value): Promise<FunctionExpression>
 isSerializedAsFunction(val: Value): boolean
}

export type Functions = Record<string, FunctionImplementation>

export class MissingFunctionError implements SaltoError {
  public severity: SaltoErrorSeverity = 'Error'
  constructor(public funcName: string) {}

  get message(): string {
    return `Invalid function name '${this.funcName}'`
  }

  toString(): string {
    return this.message
  }
}

export const getSystemFunctions = (): Functions => ({
  file: {
    toValue: (funcExp: HclExpression): Promise<StaticFileNaclValue> => {
      const [filepath] = funcExp.value.parameters

      return Promise.resolve(new StaticFileNaclValue(filepath))
    },
    fromValue: (val: Value): Promise<FunctionExpression> => Promise.resolve(new FunctionExpression(
      'file',
      [val.filepath],
    )),
    isSerializedAsFunction: (val: Value) => val instanceof StaticFileNaclValue,
  },
})

export const evaluateFunction = (
  funcExp: HclExpression,
  functions: Functions = getSystemFunctions(),
): Promise<Value | MissingFunctionError> => {
  const { funcName } = funcExp.value

  const func = functions[funcName]
  if (func === undefined) {
    return Promise.resolve(new MissingFunctionError(funcName))
  }

  return func.toValue(funcExp)
}

export const getFunctionExpression = (
  val: Value,
  functions: Functions = getSystemFunctions(),
): Promise<FunctionExpression | undefined> => {
  const [funcPerhaps] = Object.values(functions)
    .filter(maybeRelevantFuncObj => maybeRelevantFuncObj.isSerializedAsFunction(val))
    .map(funcObj => funcObj.fromValue(val))
  return funcPerhaps
}
