/*
*                      Copyright 2023 Salto Labs Ltd.
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
import Joi from 'joi'
import { createSchemeGuard, DependencyDirection } from '@salto-io/adapter-utils'
import { ElemID, ReferenceExpression } from '@salto-io/adapter-api'
import { ConditionBlock, ConditionReferenceFinder, ConditionsFullBlock, getBlockDependencyDirection, MappedReference } from './reference_finders'
// TODO add tests
// TODO future support resolve workato references before checking condition

export type dependencyFinder = (lhs: string) => { key: string; elem: ElemID }[]

const supportedOperandsConditionFuncs: Record<string, (a: string, b: string) => boolean> = {
  equals_to: (a, b) => a === b,
  contains: (a, b) => a.includes(b),
  starts_with: (a, b) => a.startsWith(b),
  ends_with: (a, b) => a.endsWith(b),
  not_contains: (a, b) => !a.includes(b),
  not_starts_with: (a, b) => !a.startsWith(b),
  not_ends_with: (a, b) => !a.endsWith(b),
  not_equals_to: (a, b) => a !== b,
  // TODO think if we want to support
  // is_present
  // is_not_present
  // greater_than
  // less_than
  // is_true
  // is not true
}

const CONDITION_BLOCK_SCHEMA = Joi.object({
  operand: Joi.string().valid(...Object.keys(supportedOperandsConditionFuncs)).required(),
  lhs: Joi.string().required(),
  rhs: Joi.string().allow('', null), // The rhs is not required for operand like 'is present'
}).unknown(true).required()


const CONDITIONS_FULL_BLOCK_SCHEMA = Joi.object({
  keyword: Joi.string().valid('if').required(),
  input: Joi.object({
    operand: Joi.string().valid('and', 'or').required(),
    conditions: Joi.array().min(1).has(CONDITION_BLOCK_SCHEMA).required(),
  }).unknown(true).required(),
}).unknown(true).required()

export const isConditionsFullBlock = createSchemeGuard<ConditionsFullBlock>(CONDITIONS_FULL_BLOCK_SCHEMA)

export const defaultAddMatchReferences = (
  lhsToDependencies: dependencyFinder,
): ConditionReferenceFinder => {
  const addConditionMatchReferences = (
    condition: (lhs: string, rhs: string) => boolean,
    conditionBlock: ConditionBlock,
    path: ElemID,
    direction: DependencyDirection | undefined,
  ): MappedReference[] => {
    const a = lhsToDependencies(conditionBlock.lhs)
      .filter(({ key }) => condition(key, conditionBlock.rhs)) // TODO what to do in case of rhs-lhs replcement
      .map(({ elem }) => ({
        location: new ReferenceExpression(path),
        direction,
        reference: new ReferenceExpression(elem),
      }))
    return a
  }

  const matchReferences : ConditionReferenceFinder = (blockValue, path) => {
    if (isConditionsFullBlock(blockValue)) {
      const direction = getBlockDependencyDirection(blockValue)
      return blockValue.input.conditions.map((
        // TODO decide if treat 'and' and 'or' condition the same
        // or we want to add 'and' condition only if all conditions are met
        // (it will cause a problem with features we dont fetch)
        conditionBlock, index
      ) => {
        const b = Object.keys(supportedOperandsConditionFuncs).includes(conditionBlock.operand)
          ? addConditionMatchReferences(
            supportedOperandsConditionFuncs[conditionBlock.operand],
            conditionBlock,
            path.createNestedID('input', 'conditions', index.toString()),
            direction
          )
          : []
        return b
      }).flat()
    }
    return []
  }
  return matchReferences
}
