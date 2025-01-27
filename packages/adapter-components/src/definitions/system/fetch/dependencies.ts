/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ContextParams, TransformDefinition } from '../shared'

export type DependsOnDefinition = {
  parentTypeName: string
  transformation: TransformDefinition<{}, unknown>
}

type ConditionBase = { match: string[] }
type ConditionByField = ConditionBase & {
  fromField: string
}
type ConditionByContext = ConditionBase & {
  fromContext: string
}

type Condition = ConditionByField | ConditionByContext

type RecurseIntoContextParamDefinition<TContext = ContextParams> = TransformDefinition<TContext, unknown>

type RecurseIntoContext = {
  args: Record<string, RecurseIntoContextParamDefinition>
}

export type RecurseIntoDefinition = {
  typeName: string
  single?: boolean
  context: RecurseIntoContext
  conditions?: Condition[]
  skipOnError?: boolean
}

export type ContextCombinationDefinition = {
  // each dependsOn combination provides a cartesian product of its possible arguments
  dependsOn?: Record<string, DependsOnDefinition>
  conditions?: Condition[]
}
