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

import { ChangeValidator, InstanceElement, ReferenceExpression, getChangeData, isAdditionChange, isInstanceChange, isInstanceElement, isReferenceExpression } from '@salto-io/adapter-api'
import _ from 'lodash'
import { resolvePath, getParents } from '@salto-io/adapter-utils'
import { values as lowerDashValues, collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { GROUP_RULE_TYPE_NAME, GROUP_TYPE_NAME, ROLE_ASSIGNMENT_TYPE_NAME } from '../constants'

const log = logger(module)
const { isDefined } = lowerDashValues
const { awu } = collections.asynciterable
const GROUP_ID_PATH = ['actions', 'assignUserToGroups', 'groupIds']

const isArrayOfRefExpr = (values: unknown): values is ReferenceExpression[] => (
  _.isArray(values)
  && values.every(isReferenceExpression)
)

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

  const groupRuleInstances = (await awu(await elementSource.list())
    .filter(id => id.typeName === GROUP_RULE_TYPE_NAME)
    .filter(id => id.idType === 'instance')
    .map(id => elementSource.get(id))
    .filter(isInstanceElement)
    .toArray())

  const targetGroupIdtoRuleIds = _.groupBy(groupRuleInstances.flatMap(rule => {
    const groups = getTargetGroupsForRule(rule)
    return groups.map(groupId => ({ ruleId: rule.elemID.name, groupName: groupId })).filter(isDefined)
  }), 'groupName')
  if (_.isEmpty(targetGroupIdtoRuleIds)) {
    return []
  }

  return roleAssignmentInstances
    .filter(role => {
      const parent = getParents(role)?.[0]
      return isReferenceExpression(parent) && targetGroupIdtoRuleIds[parent.elemID.name] !== undefined
    })
    .map(
      instance => {
        const parent = getParents(instance)?.[0]
        const groupRules = targetGroupIdtoRuleIds[parent.elemID.name].map(({ ruleId }) => ruleId)
        return ({
          elemID: instance.elemID,
          severity: 'Error',
          message: 'Unable to assign admin role to group.',
          detailedMessage: `Element ${parent.elemID.name} of type ${GROUP_TYPE_NAME} cannot be assigned an administrator role because it is a target group in the following ${GROUP_RULE_TYPE_NAME} elements: [${groupRules.join(', ')}]. Please remove all the relevant GroupRules before assigning it an administrator role, or assign the role to a different group.`,
        })
      }
    )
}
