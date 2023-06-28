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
import { apiName } from './transformers/transformer'
import { isInstanceOfCustomObjectChange } from './custom_object_instances_deploy'

const { awu } = collections.asynciterable

type ChangeGroupDescription = {
  groupId: string
  disjoint?: boolean
}

type ChangeIdFunction = (change: Change) => Promise<ChangeGroupDescription> | ChangeGroupDescription

const instanceOfCustomObjectChangeToGroupId: ChangeIdFunction = async change => ({
  groupId: `${change.action}_${await apiName(await (getChangeData(change) as InstanceElement).getType())}_instances`,
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
