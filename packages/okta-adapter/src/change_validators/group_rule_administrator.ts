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
  getChangeData,
  isInstanceChange,
  isAdditionChange,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { getInstancesFromElementSource, getParents } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { values as lowerDashValues } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { GROUP_RULE_TYPE_NAME, GROUP_TYPE_NAME, ROLE_ASSIGNMENT_TYPE_NAME } from '../constants'
import { getTargetGroupsForRule } from './role_assignment'

const { isDefined } = lowerDashValues
const log = logger(module)

/**
 * Verifies that the target groups for a GroupRule has no administrator roles.
 * Notice RoleAssignment are not fetched by default.
 */
export const groupRuleAdministratorValidator: ChangeValidator = async (changes, elementSource) => {
  if (elementSource === undefined) {
    log.error('Failed to run groupRuleAdministratorValidator because element source is undefined')
    return []
  }
  const groupRuleInstances = changes
    .filter(isInstanceChange)
    .filter(isAdditionChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === GROUP_RULE_TYPE_NAME)
  if (_.isEmpty(groupRuleInstances)) {
    return []
  }

  const roleAssignments = await getInstancesFromElementSource(elementSource, [ROLE_ASSIGNMENT_TYPE_NAME])
  if (_.isEmpty(roleAssignments)) {
    return []
  }

  const groupNamesWithRoles = new Set(
    roleAssignments
      .map(role => {
        const parent = getParents(role)?.[0]
        return isReferenceExpression(parent) && parent.elemID.typeName === GROUP_TYPE_NAME
          ? parent.elemID.name
          : undefined
      })
      .filter(isDefined),
  )

  const ruleIdToTargetGroupNames = Object.fromEntries(
    groupRuleInstances
      .map(rule => {
        const groupsWithRoles = getTargetGroupsForRule(rule).filter(groupName => groupNamesWithRoles.has(groupName))
        if (!_.isEmpty(groupsWithRoles)) {
          return [rule.elemID.getFullName(), groupsWithRoles]
        }
        return undefined
      })
      .filter(isDefined),
  )

  return groupRuleInstances
    .filter(instance => ruleIdToTargetGroupNames[instance.elemID.getFullName()] !== undefined)
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Error',
      message: 'Group membership rules cannot be created for groups with administrator roles.',
      detailedMessage: `Rules cannot assign users to groups with administrator roles. The following groups have administrator roles: ${ruleIdToTargetGroupNames[instance.elemID.getFullName()].join(', ')}. Please remove role assignemnts from groups or choose different groups as targets for this rule.`,
    }))
}
