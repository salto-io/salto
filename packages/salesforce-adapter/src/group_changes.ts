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
import { collections } from '@salto-io/lowerdash'
import { Change, ChangeGroupIdFunction, getChangeData, InstanceElement, ChangeGroupId, ChangeId } from '@salto-io/adapter-api'
import { isInstanceOfCustomObjectChange } from './custom_object_instances_deploy'
import { safeApiName } from './filters/utils'
import { ADD_APPROVAL_RULE_AND_CONDITION_GROUP, SBAA_APPROVAL_CONDITION, SBAA_APPROVAL_RULE } from './constants'

const { awu } = collections.asynciterable


type ChangeGroupDescription = {
  groupId: string
  disjoint?: boolean
}

type ChangeIdFunction = (change: Change) => Promise<ChangeGroupDescription> | ChangeGroupDescription

const getGroupId = async (change: Change<InstanceElement>): Promise<string> => {
  const typeName = await safeApiName(await getChangeData(change).getType()) ?? 'UNKNOWN'
  if (change.action === 'add' && (typeName === SBAA_APPROVAL_RULE || typeName === SBAA_APPROVAL_CONDITION)) {
    return ADD_APPROVAL_RULE_AND_CONDITION_GROUP
  }
  return `${change.action}_${typeName}_instances`
}

const instanceOfCustomObjectChangeToGroupId: ChangeIdFunction = async change => ({
  groupId: await getGroupId(change as Change<InstanceElement>),
  // CustomObjects instances might have references to instances of the same type (via Lookup
  // fields), and if we deploy them together the reference gets removed.
  disjoint: false,
})

// Everything that is not a custom object instance goes into the deploy api
const deployableMetadataChangeGroupId: ChangeIdFunction = () => ({ groupId: 'salesforce_metadata' })

export const getChangeGroupIds: ChangeGroupIdFunction = async changes => {
  const changeGroupIdMap = new Map<ChangeId, ChangeGroupId>()
  const disjointGroups = new Set<ChangeGroupId>()

  await awu(changes.entries()).forEach(async ([changeId, change]) => {
    const groupIdFunc = await isInstanceOfCustomObjectChange(change)
      ? instanceOfCustomObjectChangeToGroupId
      : deployableMetadataChangeGroupId
    const { groupId, disjoint } = await groupIdFunc(change)

    changeGroupIdMap.set(changeId, groupId)
    if (disjoint) {
      disjointGroups.add(groupId)
    }
  })

  return { changeGroupIdMap, disjointGroups }
}
