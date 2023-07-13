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
import { collections } from '@salto-io/lowerdash'
import { AUTOMATION_TYPE_NAME } from '../constants'

const { awu } = collections.asynciterable
const log = logger(module)

const areConditionsEqual = (conditions1: unknown, conditions2: unknown): boolean =>
  _.isEqualWith(conditions1, conditions2, (val1, val2) => {
    // Elements in elementSource have unresolved references, we want to make sure we handle that
    if (isReferenceExpression(val1) && isReferenceExpression(val2)) {
      return val1.elemID.isEqual(val2.elemID)
    }
    return undefined
  })

/**
 * Prevent deployment of an automation with the same conditions as another automation
 */
export const uniqueAutomationConditionsValidator: ChangeValidator = async (changes, elementSource) => {
  const changedAutomations = changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === AUTOMATION_TYPE_NAME)

  const elementSourceAutomations: InstanceElement[] = []
  if (elementSource === undefined) {
    log.error('duplicateAutomationConditionValidator might not run correctly because element source is undefined')
  } else {
    const idsIterator = awu(await elementSource.list())
    const automations: InstanceElement[] = await awu(idsIterator)
      .filter(id => id.typeName === AUTOMATION_TYPE_NAME)
      .filter(id => id.idType === 'instance')
      .map(id => elementSource.get(id))
      .toArray()
    elementSourceAutomations.push(...automations)
  }

  const allAutomations = _.uniqBy(
    [...changedAutomations, ...elementSourceAutomations],
    automation => automation.elemID.getFullName(),
  )

  const errors: ChangeError[] = []

  changedAutomations.forEach(changedAutomation => {
    allAutomations.forEach(automation => {
      if (changedAutomation.elemID.isEqual(automation.elemID)) {
        return
      }
      // If the conditions are deep equal, we return an error
      if (areConditionsEqual(changedAutomation.value.conditions, automation.value.conditions)) {
        errors.push({
          elemID: changedAutomation.elemID,
          severity: 'Error',
          message: 'Automation\'s conditions is are unique',
          detailedMessage: `Automation '${changedAutomation.elemID.getFullName()}' has the same conditions as '${automation.elemID.getFullName()}', make sure the conditions are unique before deploying.`,
        })
      }
    })
  })

  return errors
}
