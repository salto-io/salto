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
import _ from 'lodash'

import { logger } from '@salto-io/logging'
import { ElemID, Variable } from '@salto-io/adapter-api'
import { MergeError, MergeResult } from './common'

const log = logger(module)

export class DuplicateVariableNameError extends MergeError {
  constructor({ elemID }: { elemID: ElemID }) {
    super({ elemID, error: `duplicate variable ${elemID.getFullName()}` })
  }
}

const mergeVariableDefinitions = (
  variable: Variable,
  variableDefs: Variable[]
): MergeResult<Variable> => ({
  merged: variable,
  errors: variableDefs.length > 1
    ? [new DuplicateVariableNameError({ elemID: variable.elemID })]
    : [],
})

export const mergeVariables = (
  variables: Variable[]
): MergeResult<Variable[]> => {
  const mergeResults = _(variables)
    .groupBy(i => i.elemID.getFullName())
    .map(variableGroup => mergeVariableDefinitions(variableGroup[0], variableGroup))
    .value()

  const merged = mergeResults.map(r => r.merged)
  const errors = _.flatten(mergeResults.map(r => r.errors))
  log.debug(`merged ${variables.length} variables to ${merged.length} elements [errors=${
    errors.length}]`)
  return { merged, errors }
}
