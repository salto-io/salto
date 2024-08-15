/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
