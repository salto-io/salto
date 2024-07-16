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
import { ElemID, GetInsightsFunc, InstanceElement, isInstanceElement, Value } from '@salto-io/adapter-api'
import { isResolvedReferenceExpression, WALK_NEXT_STEP, walkOnElement } from '@salto-io/adapter-utils'
import { AUTOMATION_TYPE, JIRA } from '../constants'

const { makeArray } = collections.array

const AUTOMATION = 'automation'

const isAutomationInstance = (instance: InstanceElement): boolean => instance.elemID.typeName === AUTOMATION_TYPE

const getAutomationProjects = (instance: InstanceElement): Value[] =>
  makeArray(instance.value.projects)
    .map(project => project.projectId)
    .filter(projectId => projectId !== undefined)

const getAutomationsWithMissingProjects = (
  instances: InstanceElement[],
): { missingAllProjects: InstanceElement[]; missingSomeProjects: InstanceElement[] } => {
  const automationsWithMissingProjects = instances.filter(instance =>
    getAutomationProjects(instance).some(project => !isResolvedReferenceExpression(project)),
  )
  const [missingAllProjects, missingSomeProjects] = _.partition(automationsWithMissingProjects, instance =>
    getAutomationProjects(instance).every(project => !isResolvedReferenceExpression(project)),
  )
  return { missingAllProjects, missingSomeProjects }
}

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

const getDomainFromRecipient = (recipient: Value): string[] =>
  recipient?.type === 'FREE' && _.isString(recipient?.value) ? [recipient.value.split('@')[1]] : []

const getOutgoingEmailDomains = (instances: InstanceElement[]): string[] =>
  _.uniq(
    instances.flatMap(instance =>
      makeArray(instance.value.components)
        .filter(component => component.component === 'ACTION' && component.type === 'jira.issue.outgoing.email')
        .flatMap(component =>
          makeArray(component.value?.to).concat(makeArray(component.value?.cc)).concat(makeArray(component.value?.bcc)),
        )
        .flatMap(getDomainFromRecipient),
    ),
  )

const getInsights: GetInsightsFunc = elements => {
  const automationInstances = elements.filter(isInstanceElement).filter(isAutomationInstance)

  const { missingAllProjects, missingSomeProjects } = getAutomationsWithMissingProjects(automationInstances)

  const missingAllProjectsInsights = missingAllProjects.map(instance => ({
    path: instance.elemID,
    ruleId: `${AUTOMATION}.missingAllProjects`,
    message: 'Automation missing all projects',
  }))

  const missingSomeProjectsInsights = missingSomeProjects.map(instance => ({
    path: instance.elemID,
    ruleId: `${AUTOMATION}.missingSomeProjects`,
    message: 'Automation missing some projects',
  }))

  const automationsReferenceDeletedFields = automationInstances
    .filter(isAutomationReferenceDeletedFields)
    .map(instance => ({
      path: instance.elemID,
      ruleId: `${AUTOMATION}.referenceDeletedField`,
      message: 'Automation referenece deleted field',
    }))

  const outgoingEmailDomains = getOutgoingEmailDomains(automationInstances).map(domain => ({
    path: new ElemID(JIRA, AUTOMATION),
    ruleId: `${AUTOMATION}.outgoingEmailDomain`,
    message: `Automations send email to users in domain ${domain}`,
  }))

  return missingAllProjectsInsights
    .concat(missingSomeProjectsInsights)
    .concat(automationsReferenceDeletedFields)
    .concat(outgoingEmailDomains)
}

export default getInsights
