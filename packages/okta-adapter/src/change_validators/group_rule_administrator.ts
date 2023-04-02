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
import { ChangeValidator, getChangeData, isInstanceChange, isAdditionChange, InstanceElement } from '@salto-io/adapter-api'
import { resolvePath, references as referenceUtils } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { values as lowerDashValues } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { GROUP_RULE_TYPE_NAME } from '../constants'

const { isDefined } = lowerDashValues
const GROUP_ID_PATH = ['actions', 'assignUserToGroups', 'groupIds']
const { isArrayOfRefExprToInstances } = referenceUtils
const log = logger(module)

const getGroupsWithRoleByRuleId = async (groupRuleInstance: InstanceElement[]):
Promise<Record<string, InstanceElement[]>> => {
  const groupsWithRoleByRuleId = (await Promise.all(groupRuleInstance.map(async instance => {
    const elemID = instance.elemID.createNestedID(...GROUP_ID_PATH)
    const TagetGroupReferences = resolvePath(instance, elemID)
    if (!isArrayOfRefExprToInstances(TagetGroupReferences)) {
      log.debug('Could not find group references in %s', instance.elemID.getFullName())
      return undefined
    }
    const targetGroupWithRoles = TagetGroupReferences.map(groupReference => groupReference.value).filter(
      targetGroupInstance => !(_.isEmpty(targetGroupInstance.value?.roles))
    )
    if (!(_.isEmpty(targetGroupWithRoles))) {
      return [instance.elemID.getFullName(), targetGroupWithRoles]
    }
    return undefined
  }))).filter(isDefined)
  return Object.fromEntries(groupsWithRoleByRuleId)
}

/**
 * Verifies that Group target has no administrators.
 */
export const groupRuleAdministratorValidator: ChangeValidator = async changes => {
  const groupRuleInstances = changes
    .filter(isInstanceChange)
    .filter(isAdditionChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === GROUP_RULE_TYPE_NAME)
  if (_.isEmpty(groupRuleInstances)) {
    return []
  }

  const groupsWithRoleByRuleId = await getGroupsWithRoleByRuleId(groupRuleInstances)

  return groupRuleInstances.filter(instance => groupsWithRoleByRuleId[instance.elemID.getFullName()] !== undefined).map(
    instance => ({
      elemID: instance.elemID,
      severity: 'Error',
      message: 'Group membership rules cannot be created for groups with administrator roles.',
      detailedMessage: `Rules cannot assign users to groups with administrator roles. The following groups have administrator roles: ${(groupsWithRoleByRuleId[instance.elemID.getFullName()].map(group => group.elemID.name)).join(', ')}.`,
    })
  )
}
