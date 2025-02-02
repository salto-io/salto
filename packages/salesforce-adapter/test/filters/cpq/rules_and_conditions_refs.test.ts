/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  getChangeData,
  InstanceElement,
  isTemplateExpression,
  ReferenceExpression,
  TemplateExpression,
  toChange,
} from '@salto-io/adapter-api'
import { mockTypes } from '../../mock_elements'
import {
  CPQ_ADVANCED_CONDITION_FIELD,
  CPQ_INDEX_FIELD,
  CPQ_QUOTE_TERM,
  CPQ_QUOTE_TERM_FIELD,
  CPQ_TERM_CONDITION,
} from '../../../src/constants'
import { FilterWith } from '../mocks'
import filterCreator from '../../../src/filters/cpq/rules_and_conditions_refs'
import { defaultFilterContext } from '../../utils'

describe('CPQ Rules and Conditions References', () => {
  const ADVANCED_CONDITION = '1 OR (1 AND 0) OR 2'
  let ruleInstance: InstanceElement
  let condition0: InstanceElement
  let condition1: InstanceElement

  let anotherRuleInstance: InstanceElement
  let anotherCondition0: InstanceElement
  let anotherCondition1: InstanceElement

  const filter = filterCreator({
    config: defaultFilterContext,
  }) as FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>

  beforeEach(() => {
    ruleInstance = new InstanceElement('ruleInstance', mockTypes[CPQ_QUOTE_TERM], {
      [CPQ_ADVANCED_CONDITION_FIELD]: ADVANCED_CONDITION,
    })
    condition0 = new InstanceElement('condition0', mockTypes[CPQ_TERM_CONDITION], {
      [CPQ_INDEX_FIELD]: 0,
      [CPQ_QUOTE_TERM_FIELD]: new ReferenceExpression(ruleInstance.elemID),
    })
    condition1 = new InstanceElement('condition1', mockTypes[CPQ_TERM_CONDITION], {
      [CPQ_INDEX_FIELD]: 1,
      [CPQ_QUOTE_TERM_FIELD]: new ReferenceExpression(ruleInstance.elemID),
    })
    anotherRuleInstance = new InstanceElement('anotherRuleInstance', mockTypes[CPQ_QUOTE_TERM], {
      [CPQ_ADVANCED_CONDITION_FIELD]: ADVANCED_CONDITION,
    })
    anotherCondition0 = new InstanceElement('anotherCondition0', mockTypes[CPQ_TERM_CONDITION], {
      [CPQ_INDEX_FIELD]: 0,
      [CPQ_QUOTE_TERM_FIELD]: new ReferenceExpression(anotherRuleInstance.elemID),
    })
    anotherCondition1 = new InstanceElement('anotherCondition1', mockTypes[CPQ_TERM_CONDITION], {
      [CPQ_INDEX_FIELD]: 1,
      [CPQ_QUOTE_TERM_FIELD]: new ReferenceExpression(anotherRuleInstance.elemID),
    })
  })

  it('should convert advanced conditions to TemplateExpressions on fetch and deploy as string', async () => {
    await filter.onFetch([
      ruleInstance,
      condition0,
      condition1,
      anotherRuleInstance,
      anotherCondition0,
      anotherCondition1,
    ])
    const advancedCondition = ruleInstance.value[CPQ_ADVANCED_CONDITION_FIELD] as TemplateExpression
    expect(advancedCondition).toSatisfy(isTemplateExpression)
    const clonedAdvancedConditionParts = [...advancedCondition.parts]
    expect(advancedCondition.parts).toEqual([
      new ReferenceExpression(condition1.elemID, condition1),
      ' OR (',
      new ReferenceExpression(condition1.elemID, condition1),
      ' AND ',
      new ReferenceExpression(condition0.elemID, condition0),
      // Make sure we simply don't create missing references
      ') OR 2',
    ])

    const anotherAdvancedCondition = anotherRuleInstance.value[CPQ_ADVANCED_CONDITION_FIELD] as TemplateExpression
    expect(anotherAdvancedCondition).toSatisfy(isTemplateExpression)
    const clonedAnotherAdvancedConditionParts = [...anotherAdvancedCondition.parts]
    expect(anotherAdvancedCondition.parts).toEqual(clonedAnotherAdvancedConditionParts)
    expect(anotherAdvancedCondition.parts).toEqual([
      new ReferenceExpression(anotherCondition1.elemID, anotherCondition1),
      ' OR (',
      new ReferenceExpression(anotherCondition1.elemID, anotherCondition1),
      ' AND ',
      new ReferenceExpression(anotherCondition0.elemID, anotherCondition0),
      // Make sure we simply don't create missing references
      ') OR 2',
    ])

    const changes = [toChange({ after: ruleInstance }), toChange({ after: anotherRuleInstance })]
    await filter.preDeploy(changes)
    expect(changes).toHaveLength(2)
    expect(getChangeData(changes[0]).value[CPQ_ADVANCED_CONDITION_FIELD]).toEqual(ADVANCED_CONDITION)
    await filter.onDeploy(changes)

    const advancedConditionAfterDeploy = getChangeData(changes[0]).value[
      CPQ_ADVANCED_CONDITION_FIELD
    ] as TemplateExpression
    expect(advancedConditionAfterDeploy).toSatisfy(isTemplateExpression)
    expect(advancedConditionAfterDeploy.parts).toEqual(clonedAdvancedConditionParts)

    const anotherAdvancedConditionAfterDeploy = getChangeData(changes[1]).value[
      CPQ_ADVANCED_CONDITION_FIELD
    ] as TemplateExpression
    expect(anotherAdvancedConditionAfterDeploy).toSatisfy(isTemplateExpression)
    expect(anotherAdvancedConditionAfterDeploy.parts).toEqual(clonedAnotherAdvancedConditionParts)
  })
  it('should not convert advanced conditions to TemplateExpressions if no conditions are fetched for rule', async () => {
    await filter.onFetch([ruleInstance])
    expect(ruleInstance.value[CPQ_ADVANCED_CONDITION_FIELD]).toEqual(ADVANCED_CONDITION)
  })
})
