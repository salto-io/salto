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
import { ChangeValidator, getChangeData, isInstanceChange, isAdditionChange, isInstanceElement, InstanceElement, ChangeError, ReferenceExpression } from '@salto-io/adapter-api'
import { resolvePath, references as referenceUtils } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { GROUP_RULE_TYPE_NAME } from '../constants'

const GROUP_ID_PATH = ['actions', 'assignUserToGroups', 'groupIds']
const { isArrayOfRefExprToInstances } = referenceUtils

const groupRefToGroupWithRoles = async (references: ReferenceExpression[]): Promise<InstanceElement[]> => (
  await Promise.all(references.map(async reference => reference.getResolvedValue())))
  .filter(isInstanceElement)
  .filter(target => {
    const roles = target.value?.roles
    if (roles !== undefined && !(_.isEmpty(roles))) {
      return true
    }
    return false
  })

const groupRulesToGroupsRecord = async (instances: InstanceElement[]): Promise<Record<string, InstanceElement[]>> => {
  const record: Record<string, InstanceElement[]> = {}
  await Promise.all(instances.map(async instance => {
    const elemID = instance.elemID.createNestedID(...GROUP_ID_PATH)
    const references = resolvePath(instance, elemID)
    if (!isArrayOfRefExprToInstances(references)) {
      return
    }
    const targets = await groupRefToGroupWithRoles(references)
    if (targets !== undefined && !(_.isEmpty(targets))) {
      record[instance.elemID.getFullName()] = targets
    }
  }))
  return record
}

/**
 * Verifies that Group target has no administrators.
 */
export const groupRuleAdministratorValidator: ChangeValidator = async changes => {
  const relevantInstances = changes
    .filter(isInstanceChange)
    .filter(isAdditionChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === GROUP_RULE_TYPE_NAME)
  if (_.isEmpty(relevantInstances)) {
    return []
  }

  const record = await groupRulesToGroupsRecord(relevantInstances)

  // eslint-disable-next-line max-len
  return relevantInstances.filter(instance => instance.elemID.getFullName() in record).map((instance: InstanceElement): ChangeError => ({
    elemID: instance.elemID,
    severity: 'Error',
    message: 'Group membership rules cannot be created for groups with administrator roles ',
    detailedMessage: `This following groups contains administrator roles: ${(record[instance.elemID.getFullName()].map(group => group.elemID.name)).join(', ')}.`,
  }))
}
