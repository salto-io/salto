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
  FunctionExpression,
  StaticFileAssetExpression,
  Value,
} from '@salto-io/adapter-api'

type FunctionReturner =
  (funcName: string, parameters: Value[], bpPath: string) =>
    FunctionExpression

// NOTE: This is where we'd replace this with a dynamic lookup to enable custom functions to be used
const implementedFunctions = [
  StaticFileAssetExpression,
]

const functions: Record<string, FunctionReturner> = implementedFunctions
  .reduce((acc, CurrentFunctionType) => ({
    ...acc,
    ...CurrentFunctionType.functionNameAliases.reduce((aliases, alias) => ({
      ...aliases,
      ...{
        [alias]: (funcName: string, parameters: Value[], bpPath: string) =>
          new CurrentFunctionType(funcName, parameters, bpPath),
      },
    }), {}),
  }), {})

export const hasFunction = (funcName: string): boolean => funcName in functions

export const functionFactory = (funcName: string, parameters: Value[], bpPath = 'none'): FunctionExpression => {
  if (!hasFunction(funcName)) {
    // NOTE: We don't want to throw in the middle of the parsing,
    // the validators will take care of this on a higher level
    return new FunctionExpression(funcName, parameters, bpPath)
  }

  return functions[funcName](funcName, parameters, bpPath)
}
