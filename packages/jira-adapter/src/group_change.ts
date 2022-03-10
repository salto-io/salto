/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { ChangeGroupIdFunction, getChangeData, ChangeGroupId, ChangeId, isModificationChange, Change, isAdditionChange } from '@salto-io/adapter-api'
import { getParents } from '@salto-io/adapter-utils'
import { SECURITY_LEVEL_TYPE, WORKFLOW_TYPE_NAME } from './constants'

const { awu } = collections.asynciterable

type ChangeIdFunction = (change: Change) => Promise<string | undefined>


export const getWorkflowGroup: ChangeIdFunction = async change => (
  isModificationChange(change)
    && getChangeData(change).elemID.typeName === WORKFLOW_TYPE_NAME
    ? 'Workflow Modifications'
    : undefined
)

export const getSecurityLevelGroup: ChangeIdFunction = async change => (
  isAdditionChange(change)
  && getChangeData(change).elemID.typeName === SECURITY_LEVEL_TYPE
    ? getParents(getChangeData(change))[0].elemID.getFullName()
    : undefined
)

const changeIdProviders: ChangeIdFunction[] = [
  getWorkflowGroup,
  getSecurityLevelGroup,
]

export const getChangeGroupIds: ChangeGroupIdFunction = async changes => (
  new Map(
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
  )
)
