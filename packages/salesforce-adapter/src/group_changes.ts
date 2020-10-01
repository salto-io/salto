/*
*                      Copyright 2020 Salto Labs Ltd.
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
import wu from 'wu'
import { values } from '@salto-io/lowerdash'
import {
  Change, ChangeGroupIdFunction, getChangeElement, InstanceElement, ChangeGroupId, ChangeId,
} from '@salto-io/adapter-api'
import { apiName, isInstanceOfCustomObject, isMetadataInstanceElement } from './transformers/transformer'

type ChangeIdFunction = (change: Change) => string | undefined

const isInstanceOfCustomObjectChange = (
  change: Change
): change is Change<InstanceElement> => (
  isInstanceOfCustomObject(getChangeElement(change))
)

const instanceOfCustomObjectChangeToGroupId: ChangeIdFunction = change => (
  isInstanceOfCustomObjectChange(change)
    ? `${change.action}_${apiName(getChangeElement(change).type)}_instances`
    : undefined
)

const deployableMetadataChangeGroupId: ChangeIdFunction = change => (
  // Initial support only for metadata instances
  isMetadataInstanceElement(getChangeElement(change))
    ? 'salesforce_metadata'
    : undefined
)

const changeIdProviders: ChangeIdFunction[] = [
  instanceOfCustomObjectChangeToGroupId,
  deployableMetadataChangeGroupId,
]

export const getChangeGroupIds: ChangeGroupIdFunction = async changes => (
  new Map(
    wu(changes.entries())
      .map(([id, change]) => {
        const groupId = changeIdProviders
          .map(provider => provider(change))
          .find(values.isDefined)
        return groupId === undefined ? undefined : [id, groupId] as [ChangeId, ChangeGroupId]
      })
      .filter(values.isDefined)
  )
)
