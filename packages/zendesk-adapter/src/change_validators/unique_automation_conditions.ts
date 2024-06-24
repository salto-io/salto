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
  isInstanceChange,
  ChangeValidator,
  isAdditionOrModificationChange,
  ChangeError,
  getChangeData,
  InstanceElement,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { values as lowerDashValues } from '@salto-io/lowerdash'
import { getInstancesFromElementSource, safeJsonStringify } from '@salto-io/adapter-utils'
import { AUTOMATION_TYPE_NAME } from '../constants'

const { isDefined } = lowerDashValues
const log = logger(module)

const stringifyAutomationConditions = (automation: InstanceElement): string =>
  safeJsonStringify(
    automation.value.conditions,
    // ReferenceExpressions of elements from the elementSource are unresolved (meaning their values are undefined)
    // ReferenceExpressions of elements from the changes are resolved (meaning their values are not undefined)
    // Because of that we stringify manually (and unable to use elementExpressionStringifyReplacer)
    (_key, value) => (isReferenceExpression(value) ? value.elemID.getFullName() : value),
  )

/**
 * Prevent deployment and activation of an automation with the same conditions as another active automation
 */
export const uniqueAutomationConditionsValidator: ChangeValidator = async (changes, elementSource) => {
  if (elementSource === undefined) {
    log.error('Failed to run duplicateAutomationConditionValidator because element source is undefined')
    return []
  }

  const changedAutomations = changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === AUTOMATION_TYPE_NAME)
    .filter(instance => instance.value.active === true)

  const elementSourceActiveAutomations = (
    await getInstancesFromElementSource(elementSource, [AUTOMATION_TYPE_NAME])
  ).filter(automation => automation.value.active === true)

  // We map all automations to their conditions in advance, to avoid running on the whole list every time
  const conditionsToAutomations = _.groupBy(
    _.uniqBy([...changedAutomations, ...elementSourceActiveAutomations], automation => automation.elemID.getFullName()),
    stringifyAutomationConditions,
  )

  const errors = changedAutomations
    .map((automation): ChangeError | undefined => {
      const automationConditions = stringifyAutomationConditions(automation)

      if (conditionsToAutomations[automationConditions].length > 1) {
        const equalAutomations = conditionsToAutomations[automationConditions]
          .filter(otherAutomation => !otherAutomation.elemID.isEqual(automation.elemID))
          .map(equalAutomation => equalAutomation.elemID.getFullName())
          .join(', ')

        return {
          elemID: automation.elemID,
          severity: 'Error',
          message: 'Automation conditions are not unique',
          detailedMessage: `Automation has the same conditions as '${equalAutomations}', make sure the conditions are unique before deploying.`,
        }
      }
      return undefined
    })
    .filter(isDefined)

  return errors
}
