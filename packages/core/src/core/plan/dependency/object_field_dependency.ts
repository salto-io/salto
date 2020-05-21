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
import { collections } from '@salto-io/lowerdash'
import {
  getChangeElement, Field, DependencyChanger, isObjectTypeChange, ChangeEntry, DependencyChange,
  addParentDependency, isFieldChange, isDependentAction,
} from '@salto-io/adapter-api'

export const addFieldToObjectDependency: DependencyChanger = async changes => {
  const objectChanges = collections.iterable.groupBy(
    wu(changes).filter(isObjectTypeChange),
    ([_id, change]) => getChangeElement(change).elemID.getFullName(),
  )

  const addObjectDependency = ([id, change]: ChangeEntry<Field>): DependencyChange[] => (
    (objectChanges.get(getChangeElement(change).parent.elemID.getFullName()) ?? [])
      .filter(([_id, objectChange]) => isDependentAction(change.action, objectChange.action))
      .map(([objectChangeId]) => addParentDependency(id, objectChangeId))
  )

  return wu(changes)
    .filter(isFieldChange)
    .map(addObjectDependency)
    .flatten()
}
