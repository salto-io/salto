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
import { buildFetchProfile } from '../../../src/fetch_profile/fetch_profile'

describe('CPQ Rules and Conditions References', () => {
  const ADVANCED_CONDITION = '1 OR (1 AND 0) OR 2'
  let filter: FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let ruleInstance: InstanceElement
  let condition0: InstanceElement
  let condition1: InstanceElement

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
  })
  describe('when feature is disabled', () => {
    beforeEach(() => {
      filter = filterCreator({
        config: {
          ...defaultFilterContext,
          fetchProfile: buildFetchProfile({
            fetchParams: {
              optionalFeatures: {
                cpqRulesAndConditionsRefs: false,
              },
            },
          }),
        },
      }) as FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
    })
    it('should do nothing', async () => {
      await filter.onFetch([ruleInstance, condition0, condition1])
      expect(ruleInstance.value[CPQ_ADVANCED_CONDITION_FIELD]).toEqual(ADVANCED_CONDITION)
      const changes = [toChange({ after: ruleInstance })]
      await filter.preDeploy(changes)
      expect(changes).toHaveLength(1)
      expect(getChangeData(changes[0]).value[CPQ_ADVANCED_CONDITION_FIELD]).toEqual(ADVANCED_CONDITION)
      await filter.onDeploy(changes)
      expect(getChangeData(changes[0]).value[CPQ_ADVANCED_CONDITION_FIELD]).toEqual(ADVANCED_CONDITION)
    })
  })

  describe('when feature is enabled', () => {
    beforeEach(() => {
      filter = filterCreator({
        config: {
          ...defaultFilterContext,
          fetchProfile: buildFetchProfile({
            fetchParams: {
              optionalFeatures: {
                cpqRulesAndConditionsRefs: true,
              },
            },
          }),
        },
      }) as FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
    })
    it('should convert advanced conditions to TemplateExpressions on fetch and deploy as string', async () => {
      await filter.onFetch([ruleInstance, condition0, condition1])
      const advancedCondition = ruleInstance.value[CPQ_ADVANCED_CONDITION_FIELD] as TemplateExpression
      const clonedAdvancedConditionParts = [...advancedCondition.parts]
      expect(advancedCondition).toSatisfy(isTemplateExpression)
      expect(advancedCondition.parts).toEqual([
        new ReferenceExpression(condition1.elemID, condition1),
        ' OR (',
        new ReferenceExpression(condition1.elemID, condition1),
        ' AND ',
        new ReferenceExpression(condition0.elemID, condition0),
        // Make sure we simply don't create missing references
        ') OR 2',
      ])
      const changes = [toChange({ after: ruleInstance })]
      await filter.preDeploy(changes)
      expect(changes).toHaveLength(1)
      expect(getChangeData(changes[0]).value[CPQ_ADVANCED_CONDITION_FIELD]).toEqual(ADVANCED_CONDITION)
      await filter.onDeploy(changes)
      const advancedConditionAfterDeploy = getChangeData(changes[0]).value[
        CPQ_ADVANCED_CONDITION_FIELD
      ] as TemplateExpression
      expect(advancedConditionAfterDeploy).toSatisfy(isTemplateExpression)
      expect(advancedConditionAfterDeploy.parts).toEqual(clonedAdvancedConditionParts)
    })
  })
})
