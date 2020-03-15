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
  FunctionValue,
} from '@salto-io/adapter-api'
import { HclExpression } from 'src/parser/internal/types'

interface FunctionReturner{
  <T>(funcExp: HclExpression): T
}

type FunctionNameToFunctionReturner = Record<string, FunctionReturner>

const functions: FunctionNameToFunctionReturner = {}

export const hasFunction = (funcName: string): boolean => funcName in functions

export const functionFactory = (funcExp: HclExpression):
  FunctionValue => {
  const { funcName } = funcExp.value

  if (!hasFunction(funcName)) {
    throw new Error(`Invalid function name '${funcName}'`)
  }

  return functions[funcName](funcExp)
}

type FunctionReturnerWithType <T extends FunctionValue> = (funcExp: HclExpression) => T

export function registerFunctionValue<T extends FunctionValue>(
  aliases: string[],
  initializer: FunctionReturnerWithType<T>
): void {
  aliases.forEach((alias: string) => {
    functions[alias] = initializer as FunctionReturner
  })
}

// NOTE: This is where we'd replace this with a dynamic lookup to enable custom functions to be used
registerFunctionValue<StaticFileAsset>(
  ['file'],
  (funcExp: HclExpression): StaticFileAsset => {
    const [relativeFileName] = funcExp.value.parameters
    const bpPath = funcExp.source.filename

    return new StaticFileAsset(bpPath, relativeFileName)
  }
)

export const resetFunctions = (keys: string[]): void => {
  keys.forEach(key => delete functions[key])
}
