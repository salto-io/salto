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

import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { GetInsightsFunc, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { WALK_NEXT_STEP, walkOnElement } from '@salto-io/adapter-utils'
import { AUTOMATION_TYPE } from '../constants'

const { makeArray } = collections.array

const AUTOMATION = 'automation'

const isAutomationInstance = (instance: InstanceElement): boolean => instance.elemID.typeName === AUTOMATION_TYPE

const isAutomationWithoutProjects = (instance: InstanceElement): boolean =>
  makeArray(instance.value.projects).length === 0

const isAutomationReferenceDeletedFields = (instance: InstanceElement): boolean => {
  let result = false
  walkOnElement({
    element: instance,
    func: ({ value, path }) => {
      if (['field', 'selectedField'].includes(path.name) && _.isPlainObject(value) && _.isString(value.value)) {
        result = true
        return WALK_NEXT_STEP.EXIT
      }
      if (['fields'].includes(path.name) && _.isArray(value)) {
        if (value.find(item => _.isPlainObject(item) && _.isString(item.value)) !== undefined) {
          result = true
          return WALK_NEXT_STEP.EXIT
        }
        return WALK_NEXT_STEP.SKIP
      }
      if (['advancedFields'].includes(path.name) && _.isString(value)) {
        result = true
        return WALK_NEXT_STEP.EXIT
      }
      return WALK_NEXT_STEP.RECURSE
    },
  })
  return result
}

const isAutomationSendEmailOutsideOrg = (instance: InstanceElement): boolean =>
  makeArray(instance.value.components).find(
    component =>
      component.component === 'ACTION' &&
      component.type === 'jira.issue.outgoing.email' &&
      // I'm not sure about this logic
      (makeArray(component.value?.to).find(recipient => recipient.type === 'FREE') !== undefined ||
        makeArray(component.value?.cc).find(recipient => recipient.type === 'FREE') !== undefined ||
        makeArray(component.value?.bcc).find(recipient => recipient.type === 'FREE') !== undefined),
  ) !== undefined

const getInsights: GetInsightsFunc = elements => {
  const automationInstances = elements.filter(isInstanceElement).filter(isAutomationInstance)

  const automationsWithoutProjects = automationInstances.filter(isAutomationWithoutProjects).map(instance => ({
    path: instance.elemID,
    ruleId: `${AUTOMATION}.noProjects`,
    message: 'Automation without projects',
  }))

  const automationsReferenceDeletedFields = automationInstances
    .filter(isAutomationReferenceDeletedFields)
    .map(instance => ({
      path: instance.elemID,
      ruleId: `${AUTOMATION}.referenceDeletedField`,
      message: 'Automation referenece deleted field',
    }))

  const automationsSendEmailOutsideOrg = automationInstances
    .filter(isAutomationSendEmailOutsideOrg)
    .map(instance => ({
      path: instance.elemID,
      ruleId: `${AUTOMATION}.emailOutsideOrg`,
      message: 'Automation send email to users outside the organization',
    }))

  return automationsWithoutProjects.concat(automationsReferenceDeletedFields).concat(automationsSendEmailOutsideOrg)
}

export default getInsights
