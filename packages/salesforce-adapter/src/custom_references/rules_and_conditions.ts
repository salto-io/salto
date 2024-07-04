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
import { InstanceElement, ReferenceInfo } from '@salto-io/adapter-api'
import { inspectValue } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections, values } from '@salto-io/lowerdash'
import _ from 'lodash'
import {
  CPQ_ADVANCED_CONDITION_FIELD,
  CPQ_ERROR_CONDITION,
  CPQ_INDEX_FIELD,
  CPQ_PRODUCT_RULE,
  CPQ_RULE_FIELD,
} from '../constants'
import { apiNameSync, isInstanceOfCustomObjectSync } from '../filters/utils'
import { WeakReferencesHandler } from '../types'

const log = logger(module)
const { makeArray } = collections.array
const { isDefined } = values

type RuleAndConditionDef = {
  rule: {
    apiName: string
    customConditionField: string
  }
  condition: {
    apiName: string
    indexField: string
    ruleField: string
  }
}

const defs: RuleAndConditionDef[] = [
  {
    rule: {
      apiName: CPQ_PRODUCT_RULE,
      customConditionField: CPQ_ADVANCED_CONDITION_FIELD,
    },
    condition: {
      apiName: CPQ_ERROR_CONDITION,
      indexField: CPQ_INDEX_FIELD,
      ruleField: CPQ_RULE_FIELD,
    },
  },
]

const createReferencesFromRuleInstance = (
  ruleInstance: InstanceElement,
  conditionsByIndex: Record<string, InstanceElement>,
  def: RuleAndConditionDef,
): ReferenceInfo[] => {
  const condition = ruleInstance.value[def.rule.customConditionField]
  if (!_.isString(condition)) {
    return []
  }
  const indexes = condition.match(/[-+]?\d+/g)
  if (indexes == null) {
    return []
  }
  return indexes
    .map<ReferenceInfo | undefined>((index) => {
      const indexInstance = conditionsByIndex[index]
      if (indexInstance === undefined) {
        log.warn(
          `Could not find condition with index ${index} for rule ${ruleInstance.elemID.getFullName()}`,
        )
        return undefined
      }
      return {
        source: ruleInstance.elemID,
        target: indexInstance.elemID,
        type: 'strong',
      }
    })
    .filter(isDefined)
}

type CreateReferencesFromDefArgs = {
  def: RuleAndConditionDef
  dataInstancesByType: Record<string, InstanceElement[]>
}


const isConditionOfRuleFunc = (rule: InstanceElement, ruleField: string) => (condition: InstanceElement): boolean => {
  const ruleId = condition.value[ruleField]
  log.debug('ruleId: %s', inspectValue(ruleId))
  return _.isString(ruleId) && ruleId === apiNameSync(rule)
}

const getConditionIndex = (condition: InstanceElement, indexField: string): string => {
  const index = condition.value[indexField]
  return _.isString(index) ? index : ''
}

const createReferencesFromDef = ({
  def,
  dataInstancesByType,
}: CreateReferencesFromDefArgs): ReferenceInfo[] => {
  const rules = dataInstancesByType[def.rule.apiName]
  if (rules === undefined) {
    return []
  }
  return rules.flatMap(rule => {
    const isConditionOfCurrentRule = isConditionOfRuleFunc(rule, def.condition.ruleField)
    const ruleConditions = makeArray(dataInstancesByType[def.condition.apiName]).filter(isConditionOfCurrentRule)
    const conditionsByIndex = _.keyBy(ruleConditions, condition => getConditionIndex(condition, def.condition.indexField))
    return createReferencesFromRuleInstance(rule, conditionsByIndex, def)
  })

}

const findWeakReferences: WeakReferencesHandler['findWeakReferences'] = async (
  elements,
) => {
  const dataInstancesByType = _.groupBy(
    elements.filter(isInstanceOfCustomObjectSync),
    (e) => apiNameSync(e.getTypeSync()),
  )
  const references = defs.flatMap((def) =>
    createReferencesFromDef({ def, dataInstancesByType }),
  )
  log.debug('generated %d references', references.length)
  return references
}

export const rulesAndConditionsHandler: WeakReferencesHandler = {
  findWeakReferences,
  removeWeakReferences: () => async () => ({ fixedElements: [], errors: [] }),
}
