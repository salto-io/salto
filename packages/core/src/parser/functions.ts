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
  StaticFile,
  Value,
  SaltoError,
  SaltoErrorSeverity,
} from '@salto-io/adapter-api'
import { HclExpression } from './internal/types'
import { FunctionExpression } from './internal/functions'

export type FunctionImplementation = {
 toValue(funcExp: HclExpression): Value
 fromValue(val: Value): FunctionExpression
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
    toValue: (funcExp: HclExpression): StaticFile => {
      const [relativeFileName] = funcExp.value.parameters
      const naclFilePath = funcExp.source.filename

      return new StaticFile(naclFilePath, relativeFileName)
    },
    fromValue: (val: Value): FunctionExpression => new FunctionExpression(
      'file',
      [val.relativeFileName],
    ),
    isSerializedAsFunction: (val: Value) => val instanceof StaticFile,
  },
})

export const evaluateFunction = (
  funcExp: HclExpression,
  functions: Functions = getSystemFunctions(),
): Value | MissingFunctionError => {
  const { funcName } = funcExp.value

  const func = functions[funcName]
  if (func === undefined) {
    return new MissingFunctionError(funcName)
  }

  return func.toValue(funcExp)
}

export const getFunctionExpression = (
  val: Value,
  functions: Functions = getSystemFunctions(),
): FunctionExpression | undefined => {
  const [funcPerhaps] = Object.values(functions)
    .filter(maybeRelevantFuncObj => maybeRelevantFuncObj.isSerializedAsFunction(val))
    .map(funcObj => funcObj.fromValue(val))
  return funcPerhaps
}
