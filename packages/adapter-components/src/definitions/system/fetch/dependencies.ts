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
import { Values } from '@salto-io/adapter-api'
import { TransformDefinition } from '../shared'

export type DependsOnDefinition = {
  parentTypeName: string
  transformation: TransformDefinition<{}, unknown>
}

type FixedValueContextDefinition = {
  value: string | number | boolean | Values
}

type ConditionBase = { match: string[] }
type ConditionByField = ConditionBase & {
  fromField: string
}
type ConditionByContext = ConditionBase & {
  fromContext: string
}

export type Condition = ConditionByField | ConditionByContext

export const isConditionByField = (
  condition: Condition
): condition is ConditionByField => (
  'fromField' in condition
)

type RecurseIntoContextParamDefinition = {
  fromField: string
}
type RecurseIntoContext = {
  args: Record<string, RecurseIntoContextParamDefinition>
}

export type RecurseIntoDefinition = {
  typeName: string
  single?: boolean // TODON implement (maybe move to field customization?)
  context: RecurseIntoContext
  conditions?: Condition[]
  skipOnError?: boolean
}

export type ContextCombinationDefinition = {
  // TODON see if can move to requests instead - if so, can make the entire context dependsOnContext
  hardcoded?: Record<string, FixedValueContextDefinition>

  // each dependsOn combination provides a cartesian product of its possible arguments
  dependsOn?: Record<string, DependsOnDefinition>
  conditions?: Condition[]
}
