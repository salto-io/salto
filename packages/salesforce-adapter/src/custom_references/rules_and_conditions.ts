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
    typeApiName: string
    customConditionField: string
  }
  condition: {
    typeApiName: string
    indexField: string
    ruleField: string
  }
}

const defs: RuleAndConditionDef[] = [
  // CPQ Product Rules
  {
    rule: {
      typeApiName: CPQ_PRODUCT_RULE,
      customConditionField: CPQ_ADVANCED_CONDITION_FIELD,
    },
    condition: {
      typeApiName: CPQ_ERROR_CONDITION,
      indexField: CPQ_INDEX_FIELD,
      ruleField: CPQ_RULE_FIELD,
    },
  },
  // CPQ Quote Terms
  {
    rule: {
      typeApiName: CPQ_QUOTE_TERM,
      customConditionField: CPQ_ADVANCED_CONDITION_FIELD,
    },
    condition: {
      typeApiName: CPQ_TERM_CONDITON,
      indexField: CPQ_INDEX_FIELD,
      ruleField: CPQ_QUOTE_TERM_FIELD,
    },
  },
  // CPQ Price Rules
  {
    rule: {
      typeApiName: CPQ_PRICE_RULE,
      customConditionField: CPQ_ADVANCED_CONDITION_FIELD,
    },
    condition: {
      typeApiName: CPQ_PRICE_CONDITION,
      indexField: CPQ_INDEX_FIELD,
      ruleField: CPQ_RULE_FIELD,
    },
  },
  // SBAA Approval Rules
  {
    rule: {
      typeApiName: SBAA_APPROVAL_RULE,
      customConditionField: SBAA_ADVANCED_CONDITION_FIELD,
    },
    condition: {
      typeApiName: SBAA_APPROVAL_CONDITION,
      indexField: SBAA_INDEX_FIELD,
      ruleField: SBAA_APPROVAL_RULE,
    },
  },
]

const createReferencesFromRuleInstance = (
  ruleInstance: InstanceElement,
  conditionsByIndex: Record<number, InstanceElement>,
  def: RuleAndConditionDef,
): ReferenceInfo[] => {
  const condition = ruleInstance.value[def.rule.customConditionField]
  if (!_.isString(condition)) {
    return []
  }
  const regexMatch = condition.match(/(?<!\S)\d+(?!\S)/g)
  if (regexMatch == null) {
    return []
  }
  // We should avoid creating mutliple references to the same condition
  // e.g. the following custom condition is valid: "0 OR (0 AND 1)"
  const indexes = _.uniq(Array.from(regexMatch.values())).map(Number)
  return indexes
    .map((index): ReferenceInfo | undefined => {
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

const isConditionOfRuleFunc =
  (rule: InstanceElement, ruleField: string) =>
  (condition: InstanceElement): boolean => {
    const ruleRef = condition.value[ruleField]
    return isReferenceExpression(ruleRef) && ruleRef.elemID.isEqual(rule.elemID)
  }

const getConditionIndex = (
  condition: InstanceElement,
  indexField: string,
): number | undefined => {
  const index = condition.value[indexField]
  return _.isNumber(index) ? index : undefined
}

const createReferencesFromDef = ({
  def,
  instancesByType,
}: {
  def: RuleAndConditionDef
  instancesByType: Record<string, InstanceElement[]>
}): ReferenceInfo[] => {
  const rules = instancesByType[def.rule.typeApiName]
  if (rules === undefined) {
    return []
  }
  return rules.flatMap((rule) => {
    const isConditionOfCurrentRule = isConditionOfRuleFunc(
      rule,
      def.condition.ruleField,
    )
    const ruleConditions = makeArray(
      instancesByType[def.condition.typeApiName],
    ).filter(isConditionOfCurrentRule)
    const conditionsByIndex = ruleConditions.reduce<
      Record<number, InstanceElement>
    >((acc, condition) => {
      const index = getConditionIndex(condition, def.condition.indexField)
      if (index !== undefined) {
        acc[index] = condition
      }
      return acc
    }, {})
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
