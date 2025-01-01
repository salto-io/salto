/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { collections } from '@salto-io/lowerdash'
import { validatePlainObject } from '@salto-io/adapter-utils'
import { AdjustFunctionSingle, ContextParams } from './definitions'

const { awu } = collections.asynciterable

/**
 * Concatenates multiple adjust functions into a single adjust function.
 * The adjust functions will be applied in the order they are provided.
 */
export const concatAdjustFunctions =
  <TContext = ContextParams>(...adjustFunctions: AdjustFunctionSingle<TContext>[]): AdjustFunctionSingle<TContext> =>
  async ({ value, typeName, ...args }) => {
    validatePlainObject(value, typeName)
    let currentArgs = { ...args, value, typeName }
    await awu(adjustFunctions).forEach(async adjustFunc => {
      const result = await adjustFunc(currentArgs)
      currentArgs = { ...currentArgs, ...result }
    })
    return currentArgs
  }
