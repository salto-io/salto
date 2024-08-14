/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, Variable } from '@salto-io/adapter-api'
import { MergeError, MergeResult } from './common'

export class DuplicateVariableNameError extends MergeError {
  constructor({ elemID }: { elemID: ElemID }) {
    super({ elemID, error: `duplicate variable ${elemID.getFullName()}` })
  }
}

const mergeVariableDefinitions = (variableDefs: Variable[]): MergeResult<Variable> => ({
  merged: variableDefs[0],
  errors: variableDefs.length > 1 ? [new DuplicateVariableNameError({ elemID: variableDefs[0].elemID })] : [],
})

export const mergeVariables = (variables: Variable[]): MergeResult<Variable> => mergeVariableDefinitions(variables)
