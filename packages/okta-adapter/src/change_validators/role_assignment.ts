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
  ChangeValidator,
  InstanceElement,
  ReferenceExpression,
  getChangeData,
  isAdditionChange,
  isInstanceChange,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { resolvePath, getParents, getInstancesFromElementSource } from '@salto-io/adapter-utils'
import { values as lowerDashValues } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { GROUP_RULE_TYPE_NAME, GROUP_TYPE_NAME, ROLE_ASSIGNMENT_TYPE_NAME } from '../constants'

const log = logger(module)
const { isDefined } = lowerDashValues
const GROUP_ID_PATH = ['actions', 'assignUserToGroups', 'groupIds']

const isArrayOfRefExpr = (values: unknown): values is ReferenceExpression[] =>
  _.isArray(values) && values.every(isReferenceExpression)

export const getTargetGroupsForRule = (groupRule: InstanceElement): string[] => {
  const targetGroupsPath = groupRule.elemID.createNestedID(...GROUP_ID_PATH)
  const targetGroupReferences = resolvePath(groupRule, targetGroupsPath)
  if (!isArrayOfRefExpr(targetGroupReferences)) {
    log.debug('Could not find group references in %s', groupRule.elemID.getFullName())
    return []
  }
  return targetGroupReferences.map(ref => ref.elemID.name)
}

/**
 * prevents the assignment of admin roles to groups that are defined as "target groups" in other
 * group rules.
 * Notice RoleAssignment are not fetched by default.
 */
export const roleAssignmentValidator: ChangeValidator = async (changes, elementSource) => {
  if (elementSource === undefined) {
    log.error('Failed to run roleAssignmentValidator because element source is undefined')
    return []
  }

  const roleAssignmentInstances = changes
    .filter(isInstanceChange)
    .filter(isAdditionChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === ROLE_ASSIGNMENT_TYPE_NAME)
  if (_.isEmpty(roleAssignmentInstances)) {
    return []
  }

  const groupRuleInstances = await getInstancesFromElementSource(elementSource, [GROUP_RULE_TYPE_NAME])

  const targetGroupIdtoRuleIds = _.groupBy(
    groupRuleInstances.flatMap(rule => {
      const groups = getTargetGroupsForRule(rule)
      return groups.map(groupName => ({ ruleId: rule.elemID.name, groupName })).filter(isDefined)
    }),
    'groupName',
  )

  return roleAssignmentInstances
    .filter(role => {
      const parent = getParents(role)?.[0]
      return (
        isReferenceExpression(parent) &&
        parent.elemID.typeName === GROUP_TYPE_NAME &&
        targetGroupIdtoRuleIds[parent.elemID.name] !== undefined
      )
    })
    .map(instance => {
      const parent = getParents(instance)?.[0]
      const groupRules = targetGroupIdtoRuleIds[parent.elemID.name].map(({ ruleId }) => ruleId)
      return {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Unable to assign admin role to group.',
        detailedMessage: `Element ${parent.elemID.name} of type ${GROUP_TYPE_NAME} cannot be assigned an administrator role because it is a target group in the following ${GROUP_RULE_TYPE_NAME} elements: [${groupRules.join(', ')}]. Please remove all the relevant GroupRules before assigning it an administrator role, or assign the role to a different group.`,
      }
    })
}
