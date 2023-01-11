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
import { collections, values } from '@salto-io/lowerdash'
import { ChangeGroupIdFunction, getChangeData, ChangeGroupId, ChangeId, isModificationChange, Change, isAdditionChange, isReferenceExpression } from '@salto-io/adapter-api'
import { getParent, getParents } from '@salto-io/adapter-utils'
import { FIELD_CONFIGURATION_ITEM_TYPE_NAME, SECURITY_LEVEL_TYPE, WORKFLOW_TYPE_NAME } from './constants'

const { awu } = collections.asynciterable

type ChangeIdFunction = (change: Change) => Promise<string | undefined>


export const getWorkflowGroup: ChangeIdFunction = async change => (
  isModificationChange(change)
    && getChangeData(change).elemID.typeName === WORKFLOW_TYPE_NAME
    ? 'Workflow Modifications'
    : undefined
)

export const getSecurityLevelGroup: ChangeIdFunction = async change => {
  const instance = getChangeData(change)
  if (!isAdditionChange(change)
    || instance.elemID.typeName !== SECURITY_LEVEL_TYPE) {
    return undefined
  }

  const parents = getParents(instance)
  if (parents.length !== 1 || !isReferenceExpression(parents[0])) {
    throw new Error(`${instance.elemID.getFullName()} must have exactly one reference expression parent`)
  }

  return parents[0].elemID.getFullName()
}


const getFieldConfigItemGroup: ChangeIdFunction = async change => {
  const instance = getChangeData(change)
  if (instance.elemID.typeName !== FIELD_CONFIGURATION_ITEM_TYPE_NAME) {
    return undefined
  }

  const parent = getParent(instance)

  return `${parent.elemID.getFullName()} items`
}

const changeIdProviders: ChangeIdFunction[] = [
  getWorkflowGroup,
  getSecurityLevelGroup,
  getFieldConfigItemGroup,
]

export const getChangeGroupIds: ChangeGroupIdFunction = async changes => ({
  changeGroupIdMap: new Map(
    await awu(changes.entries())
      .map(async ([id, change]) => {
        const groupId = await awu(changeIdProviders)
          .map(provider => provider(change))
          .find(values.isDefined)
        return groupId === undefined
          ? [id, getChangeData(change).elemID.getFullName()] as [ChangeId, ChangeGroupId]
          : [id, groupId] as [ChangeId, ChangeGroupId]
      })
      .filter(values.isDefined)
      .toArray()
  ),
})
