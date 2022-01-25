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
import { values, collections } from '@salto-io/lowerdash'
import { Change, ChangeGroupIdFunction, getChangeData, ChangeGroupId, ChangeId, InstanceElement } from '@salto-io/adapter-api'
import { apiName } from './transformers/transformer'
import { isInstanceOfCustomObjectChange } from './custom_object_instances_deploy'

const { awu } = collections.asynciterable

type ChangeIdFunction = (change: Change) => Promise<string | undefined> | string | undefined

const instanceOfCustomObjectChangeToGroupId: ChangeIdFunction = async change => (
  await isInstanceOfCustomObjectChange(change)
    ? `${change.action}_${await apiName(await (getChangeData(change) as InstanceElement).getType())}_instances`
    : undefined
)

// Everything that is not a custom object instance goes into the deploy api
const deployableMetadataChangeGroupId: ChangeIdFunction = () => 'salesforce_metadata'

const changeIdProviders: ChangeIdFunction[] = [
  instanceOfCustomObjectChangeToGroupId,
  deployableMetadataChangeGroupId,
]

export const getChangeGroupIds: ChangeGroupIdFunction = async changes => (
  new Map(
    await awu(changes.entries())
      .map(async ([id, change]) => {
        const groupId = await awu(changeIdProviders)
          .map(provider => provider(change))
          .find(values.isDefined)
        return groupId === undefined ? undefined : [id, groupId] as [ChangeId, ChangeGroupId]
      })
      .filter(values.isDefined)
      .toArray()
  )
)
