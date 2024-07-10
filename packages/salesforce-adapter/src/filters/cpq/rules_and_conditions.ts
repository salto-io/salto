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

import { Change, getChangeData, InstanceElement, isAdditionOrModificationChange, isReferenceExpression, ReferenceExpression } from '@salto-io/adapter-api'
import { applyFunctionToChangeData, createTemplateExpression } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { CPQ_ADVANCED_CONDITION_FIELD, CPQ_ERROR_CONDITION, CPQ_INDEX_FIELD, CPQ_PRICE_CONDITION, CPQ_PRICE_RULE, CPQ_PRODUCT_RULE, CPQ_QUOTE_TERM, CPQ_QUOTE_TERM_FIELD, CPQ_RULE_FIELD, CPQ_TERM_CONDITON, SBAA_ADVANCED_CONDITION_FIELD, SBAA_APPROVAL_CONDITION, SBAA_APPROVAL_RULE, SBAA_INDEX_FIELD } from '../../constants'
import {LocalFilterCreator} from '../../filter'
import { apiNameSync, isInstanceOfCustomObjectChangeSync, isInstanceOfCustomObjectSync } from '../utils'


const {makeArray} = collections.array
const log = logger(module)

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

const ruleTypeNames = defs.map(def => def.rule.typeApiName)

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

const setCustomConditionReferences = ({rule, conditionsByIndex, def}: {
  rule: InstanceElement
  conditionsByIndex: Record<number, InstanceElement>
  def: RuleAndConditionDef
}): number => {
  let createdReferences = 0
  const customCondition = rule.value[def.rule.customConditionField]
  if (!_.isString(customCondition)) {
    return 0
  }
  log.debug('%s', conditionsByIndex)
  const rawParts = customCondition.match(/(\d+|[^\d]+)/g)?.filter(Boolean)
  if (rawParts === undefined || !rawParts.some(Number)) {
    return 0
  }
  const templateExpression = createTemplateExpression({
    parts: rawParts.map(part => {
      const index = Number(part)
      if (index === undefined) {
        return part
      }
      const condition = conditionsByIndex[index]
      if (condition === undefined) {
        log.warn(
          `Could not find condition with index ${index} for rule ${rule.elemID.getFullName()}`,
        )
        return part
      }
      createdReferences += 1
      return new ReferenceExpression(condition.elemID, condition)
    }),
  })
  rule.value[def.rule.customConditionField] = templateExpression
  return createdReferences
}

const createReferencesFromDef = ({
  def,
  instancesByType,
}: {
  def: RuleAndConditionDef
  instancesByType: Record<string, InstanceElement[]>
}): number => {
  const rules = instancesByType[def.rule.typeApiName]
  if (rules === undefined) {
    return 0
  }
  return _.sum(rules.map(rule => {
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
    return setCustomConditionReferences({rule, conditionsByIndex, def})
  }))
}

const isCPQRuleChange = (change: Change): change is Change<InstanceElement> => (
  isInstanceOfCustomObjectChangeSync(change)
  && ruleTypeNames.includes(apiNameSync(getChangeData(change).getTypeSync()) ?? '')
)

const filterCreator: LocalFilterCreator = ({ config }) => ({
  name: 'cpqRulesAndConditionsFilter',
  
  onFetch: async elements => {
    if (!config.fetchProfile.isFeatureEnabled('cpqRulesAndConditionsRefs')) {
      log.debug('feature is disabled. Skipping filter')
      return
    }
    const dataInstanesByType = _.groupBy(
      elements.filter(isInstanceOfCustomObjectSync),
      instance => apiNameSync(instance.getTypeSync())
    )
    const referencesCreated = _.sum(defs.map(def => createReferencesFromDef({def, instancesByType: dataInstanesByType})))
    log.debug('Created %d references', referencesCreated)
  },
  preDeploy: async changes => {
    const ruleChanges = changes
      .filter(isInstanceOfCustomObjectChangeSync)
      .filter(isAdditionOrModificationChange)
      .filter(change => defs.some(def => apiNameSync(getChangeData(change).getTypeSync()) === def.rule.typeApiName))
      .forEach(change => applyFunctionToChangeData(change, instance => {

    })
  }
})

export default filterCreator