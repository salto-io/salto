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

import { Value, SaltoError, SeverityLevel } from '@salto-io/adapter-api'
import { FunctionExpression } from './internal/functions'

export { FunctionExpression } from './internal/functions'

export type FunctionImplementation = {
  parse(parameters: Value[]): Promise<Value>
  dump(val: Value): Promise<FunctionExpression>
  isSerializedAsFunction(val: Value): boolean
}

export type Functions = Record<string, FunctionImplementation>

export class MissingFunctionError implements SaltoError {
  public severity: SeverityLevel = 'Error'
  constructor(public funcName: string) {}

  get message(): string {
    return `Invalid function name '${this.funcName}'`
  }

  toString(): string {
    return this.message
  }
}

export const evaluateFunction = (
  funcName: string,
  parameters: Value[],
  functions: Functions,
): Promise<Value | MissingFunctionError> => {
  const func = functions[funcName]
  if (func === undefined) {
    return Promise.resolve(new MissingFunctionError(funcName))
  }

  return func.parse(parameters)
}

export const getFunctionExpression = (val: Value, functions: Functions): Promise<FunctionExpression> | undefined => {
  const [funcPerhaps] = Object.values(functions)
    .filter(maybeRelevantFuncObj => maybeRelevantFuncObj.isSerializedAsFunction(val))
    .map(funcObj => funcObj.dump(val))
  return funcPerhaps
}
