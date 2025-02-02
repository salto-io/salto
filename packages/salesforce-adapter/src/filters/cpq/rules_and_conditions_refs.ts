/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  Change,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceElement,
  isReferenceExpression,
  ReferenceExpression,
  TemplateExpression,
  TemplatePart,
} from '@salto-io/adapter-api'
import {
  compactTemplate,
  createTemplateExpression,
  inspectValue,
  replaceTemplatesWithValues,
  resolveTemplates,
} from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
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
} from '../../constants'
import { FilterCreator } from '../../filter'
import {
  apiNameSync,
  buildElementsSourceForFetch,
  isInstanceOfCustomObjectChangeSync,
  isInstanceOfCustomObjectSync,
} from '../utils'

const { toArrayAsync } = collections.asynciterable
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
const conditionTypeNames = defs.map(def => def.condition.typeApiName)

const resolveConditionIndexFunc =
  (indexField: string) =>
  (ref: ReferenceExpression): TemplatePart => {
    const refValue = ref.value
    if (!isInstanceElement(refValue)) {
      log.warn('Received non instance reference %s. refValue is %s', ref.elemID.getFullName(), inspectValue(refValue))
      return ref
    }
    const index: unknown = refValue.value[indexField]
    if (!_.isNumber(index)) {
      log.warn(
        'Received non number index for instance %s with values %s',
        refValue.elemID.getFullName(),
        inspectValue(refValue.value),
      )
      return ref
    }
    return index.toString()
  }

export const isConditionOfRuleFunc =
  (rule: InstanceElement, ruleField: string) =>
  (condition: InstanceElement): boolean => {
    const ruleRef = condition.value[ruleField]
    if (_.isString(ruleRef)) {
      return apiNameSync(rule) === ruleRef
    }
    if (isReferenceExpression(ruleRef)) {
      return ruleRef.elemID.isEqual(rule.elemID)
    }
    return false
  }

const getConditionIndex = (condition: InstanceElement, indexField: string): number | undefined => {
  const index = condition.value[indexField]
  return _.isNumber(index) ? index : undefined
}

const setCustomConditionReferences = ({
  rule,
  conditionsByIndex,
  def,
}: {
  rule: InstanceElement
  conditionsByIndex: Record<number, InstanceElement>
  def: RuleAndConditionDef
}): number => {
  let createdReferences = 0
  const customCondition = rule.value[def.rule.customConditionField]
  if (!_.isString(customCondition)) {
    return 0
  }
  const rawParts = customCondition.match(/(\d+|[^\d]+)/g)
  if (rawParts == null || rawParts.every(part => _.isNaN(Number(part)))) {
    return 0
  }
  rule.value[def.rule.customConditionField] = compactTemplate(
    createTemplateExpression({
      parts: rawParts.map(part => {
        const index = Number(part)
        if (Number.isNaN(index)) {
          return part
        }
        const condition = conditionsByIndex[index]
        if (condition === undefined) {
          log.warn(`Could not find condition with index ${index} for rule ${rule.elemID.getFullName()}`)
          return part
        }
        createdReferences += 1
        return new ReferenceExpression(condition.elemID, condition)
      }),
    }),
  )
  return createdReferences
}

const createReferencesFromDef = ({
  def,
  ruleInstancesByType,
  conditionInstancesByType,
}: {
  def: RuleAndConditionDef
  ruleInstancesByType: Record<string, InstanceElement[]>
  conditionInstancesByType: Record<string, InstanceElement[]>
}): number => {
  const rules = ruleInstancesByType[def.rule.typeApiName]
  if (rules === undefined) {
    return 0
  }
  return _.sum(
    rules.map(rule => {
      const isConditionOfCurrentRule = isConditionOfRuleFunc(rule, def.condition.ruleField)
      const ruleConditions = (conditionInstancesByType[def.condition.typeApiName] ?? []).filter(
        isConditionOfCurrentRule,
      )
      const conditionsByIndex = ruleConditions.reduce<Record<number, InstanceElement>>((acc, condition) => {
        const index = getConditionIndex(condition, def.condition.indexField)
        if (index !== undefined) {
          acc[index] = condition
        }
        return acc
      }, {})
      return setCustomConditionReferences({ rule, conditionsByIndex, def })
    }),
  )
}

const isCPQRuleChange = (change: Change): change is Change<InstanceElement> =>
  isInstanceOfCustomObjectChangeSync(change) &&
  ruleTypeNames.includes(apiNameSync(getChangeData(change).getTypeSync()) ?? '')

const filterCreator: FilterCreator = ({ config }) => {
  const templateMappingByRuleTypeAndInstance: Partial<
    Record<string, Record<string, Record<string, TemplateExpression>>>
  > = {}
  return {
    name: 'cpqRulesAndConditionsFilter',
    onFetch: async elements => {
      const ruleInstancesByType = _.pick(
        _.groupBy(elements.filter(isInstanceOfCustomObjectSync), instance => apiNameSync(instance.getTypeSync()) ?? ''),
        ruleTypeNames,
      )
      if (Object.keys(ruleInstancesByType).length === 0) {
        log.debug('No rule instances were fetched. Skipping filter')
        return
      }
      const conditionInstancesByType = _.pick(
        _.groupBy(
          (await toArrayAsync(await buildElementsSourceForFetch(elements, config).getAll())).filter(
            isInstanceOfCustomObjectSync,
          ),
          instance => apiNameSync(instance.getTypeSync()) ?? '',
        ),
        conditionTypeNames,
      )
      const referencesCreated = _.sum(
        defs.map(def =>
          createReferencesFromDef({
            def,
            ruleInstancesByType,
            conditionInstancesByType,
          }),
        ),
      )
      log.debug('Created %d references', referencesCreated)
    },
    preDeploy: async changes => {
      const ruleChanges = changes.filter(isCPQRuleChange).filter(isAdditionOrModificationChange)
      if (ruleChanges.length === 0) {
        return
      }
      const rulesInstancesByType = _.groupBy(
        ruleChanges.map(getChangeData),
        rule => apiNameSync(rule.getTypeSync()) ?? '',
      )
      defs.forEach(def => {
        const rules = rulesInstancesByType[def.rule.typeApiName] ?? []
        if (rules.length === 0) {
          return
        }
        const templateMappingByInstance: Record<string, Record<string, TemplateExpression>> = {}
        rules.forEach(rule => {
          const templateMapping = {}
          replaceTemplatesWithValues(
            {
              values: [rule.value],
              fieldName: def.rule.customConditionField,
            },
            templateMapping,
            resolveConditionIndexFunc(def.condition.indexField),
          )
          templateMappingByInstance[rule.elemID.getFullName()] = templateMapping
        })
        if (Object.keys(templateMappingByInstance).length > 0) {
          templateMappingByRuleTypeAndInstance[def.rule.typeApiName] = templateMappingByInstance
        }
      })
    },
    onDeploy: async changes => {
      const ruleChanges = changes.filter(isCPQRuleChange).filter(isAdditionOrModificationChange)
      if (ruleChanges.length === 0) {
        return
      }
      const rulesInstancesByType = _.groupBy(
        ruleChanges.map(getChangeData),
        rule => apiNameSync(rule.getTypeSync()) ?? '',
      )
      defs.forEach(def => {
        const rules = rulesInstancesByType[def.rule.typeApiName] ?? []
        const templateMappingByInstance = templateMappingByRuleTypeAndInstance[def.rule.typeApiName]
        if (!templateMappingByInstance || Object.keys(templateMappingByInstance).length === 0 || rules.length === 0) {
          return
        }
        rules.forEach(rule => {
          const templateMapping = templateMappingByInstance[rule.elemID.getFullName()]
          if (!templateMapping) {
            return
          }
          resolveTemplates(
            {
              values: [rule.value],
              fieldName: def.rule.customConditionField,
            },
            templateMapping,
          )
        })
      })
    },
  }
}

export default filterCreator
