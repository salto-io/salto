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

import { definitions } from '@salto-io/adapter-components'
import { values as lowerdashValues, collections } from '@salto-io/lowerdash'

const { awu } = collections.asynciterable

export const validateValue = (value: unknown): Record<string, unknown> => {
  if (!lowerdashValues.isPlainRecord(value)) {
    throw new Error('Can not adjust when the value is not an object')
  }
  return value
}

export const createAdjustFunctionFromMultipleFunctions =
  (
    functions: definitions.AdjustFunctionSingle<definitions.deploy.ChangeAndContext>[],
  ): definitions.AdjustFunctionSingle<definitions.deploy.ChangeAndContext> =>
  async args => {
    const value = validateValue(args.value)
    const argsWithValidatedValue = { ...args, value }
    const res = await awu(functions)
      .map(adjust => adjust(argsWithValidatedValue))
      .toArray()
    res.pop()
    return res.pop() ?? argsWithValidatedValue
  }
