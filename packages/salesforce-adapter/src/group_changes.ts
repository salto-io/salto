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
import {
  Change, ChangeGroupIdFunction, getChangeElement, InstanceElement, ChangeEntry,
} from '@salto-io/adapter-api'
import { apiName, isInstanceOfCustomObject } from './transformers/transformer'

export const getChangeGroupIds: ChangeGroupIdFunction = async changes => {
  const isInstanceOfCustomObjectChange = (
    change: ChangeEntry
  ): change is ChangeEntry<InstanceElement> => {
    const changeElement = getChangeElement(change[1])
    return isInstanceOfCustomObject(changeElement)
  }
  const instanceOfCustomObjectChangeToGroupId = (change: Change<InstanceElement>): string =>
    `${change.action}_${apiName(getChangeElement(change).type)}_instances`

  return new Map(
    wu(changes.entries())
      .filter(isInstanceOfCustomObjectChange)
      .map(([id, change]) => [id, instanceOfCustomObjectChangeToGroupId(change)])
  )
}
