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
import {
  InstanceElement,
  isInstanceElement,
  isReferenceExpression,
  ReferenceInfo,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections, values } from '@salto-io/lowerdash'
import _ from 'lodash'
import {
  CPQ_ADVANCED_CONDITION_FIELD,
  CPQ_ERROR_CONDITION,
  CPQ_INDEX_FIELD,
  CPQ_PRICE_CONDITION,
  CPQ_PRICE_RULE,
  CPQ_PRODUCT_RULE,
  CPQ_QUOTE_TERM,
  CPQ_QUOTE_TERM_FIELD,
  CPQ_RULE_FIELD,
  CPQ_TERM_CONDITON,
  SBAA_ADVANCED_CONDITION_FIELD,
  SBAA_APPROVAL_CONDITION,
  SBAA_APPROVAL_RULE,
  SBAA_INDEX_FIELD,
} from '../constants'
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
  // CPQ Product Rules
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
  // CPQ Quote Terms
  {
    rule: {
      apiName: CPQ_QUOTE_TERM,
      customConditionField: CPQ_ADVANCED_CONDITION_FIELD,
    },
    condition: {
      apiName: CPQ_TERM_CONDITON,
      indexField: CPQ_INDEX_FIELD,
      ruleField: CPQ_QUOTE_TERM_FIELD,
    },
  },
  // CPQ Price Rules
  {
    rule: {
      apiName: CPQ_PRICE_RULE,
      customConditionField: CPQ_ADVANCED_CONDITION_FIELD,
    },
    condition: {
      apiName: CPQ_PRICE_CONDITION,
      indexField: CPQ_INDEX_FIELD,
      ruleField: CPQ_RULE_FIELD,
    },
  },
  // SBAA Approval Rules
  {
    rule: {
      apiName: SBAA_APPROVAL_RULE,
      customConditionField: SBAA_ADVANCED_CONDITION_FIELD,
    },
    condition: {
      apiName: SBAA_APPROVAL_CONDITION,
      indexField: SBAA_INDEX_FIELD,
      ruleField: SBAA_APPROVAL_RULE,
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
  const regexMatch = condition.match(/?\d+/g)
  if (regexMatch == null) {
    return []
  }
  // We should avoid creating mutliple references to the same condition
  // e.g. the following custom condition is valid: "0 OR (0 AND 1)"
  const indexes = _.uniq(Array.from(regexMatch.values()))
  return indexes
    .map<ReferenceInfo | undefined>((index) => {
      const conditionInstance = conditionsByIndex[index]
      if (conditionInstance === undefined) {
        log.warn(
          `Could not find condition with index ${index} for rule ${ruleInstance.elemID.getFullName()}`,
        )
        return undefined
      }
      return {
        source: ruleInstance.elemID,
        target: conditionInstance.elemID,
        type: 'strong',
      }
    })
    .filter(isDefined)
}

type CreateReferencesFromDefArgs = {
  def: RuleAndConditionDef
  instancesByType: Record<string, InstanceElement[]>
}

const isConditionOfRuleFunc =
  (rule: InstanceElement, ruleField: string) =>
  (condition: InstanceElement): boolean => {
    const ruleRef = condition.value[ruleField]
    return (
      isReferenceExpression(ruleRef) &&
      ruleRef.elemID.getFullName() === rule.elemID.getFullName()
    )
  }

const getConditionIndex = (
  condition: InstanceElement,
  indexField: string,
): number => {
  const index = condition.value[indexField]
  return _.isNumber(index) ? index : -1
}

const createReferencesFromDef = ({
  def,
  instancesByType,
}: CreateReferencesFromDefArgs): ReferenceInfo[] => {
  const rules = instancesByType[def.rule.apiName]
  if (rules === undefined) {
    return []
  }
  return rules.flatMap((rule) => {
    const isConditionOfCurrentRule = isConditionOfRuleFunc(
      rule,
      def.condition.ruleField,
    )
    const ruleConditions = makeArray(
      instancesByType[def.condition.apiName],
    ).filter(isConditionOfCurrentRule)
    const conditionsByIndex = _.keyBy(ruleConditions, (condition) =>
      getConditionIndex(condition, def.condition.indexField),
    )
    return createReferencesFromRuleInstance(rule, conditionsByIndex, def)
  })
}

const findWeakReferences: WeakReferencesHandler['findWeakReferences'] = async (
  elements,
) => {
  log.debug('rules and conditions handler started')
  const instancesByType = _.groupBy(
    elements.filter(isInstanceElement),
    (e) => e.elemID.typeName,
  )
  const references = defs.flatMap((def) =>
    createReferencesFromDef({ def, instancesByType }),
  )
  log.debug('generated %d references', references.length)
  return references
}

export const rulesAndConditionsHandler: WeakReferencesHandler = {
  findWeakReferences,
  removeWeakReferences: () => async () => ({ fixedElements: [], errors: [] }),
}
