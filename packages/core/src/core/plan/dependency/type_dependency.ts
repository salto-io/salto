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
  Field, InstanceElement, isType, getChangeElement, ChangeEntry, isFieldChange, isInstanceChange,
  DependencyChanger, DependencyChange, addReferenceDependency, isDependentAction,
} from '@salto-io/adapter-api'

type FieldOrInstanceChange = ChangeEntry<Field | InstanceElement>
const isFieldOrInstanceChange = (entry: ChangeEntry): entry is FieldOrInstanceChange => (
  isFieldChange(entry) || isInstanceChange(entry)
)

export const addTypeDependency: DependencyChanger = async changes => {
  const typeChanges = collections.iterable.groupBy(
    wu(changes).filter(([_id, change]) => isType(getChangeElement(change))),
    ([_id, change]) => getChangeElement(change).elemID.getFullName(),
  )

  const addChangeTypeDependency = ([id, change]: FieldOrInstanceChange): DependencyChange[] => (
    (typeChanges.get(getChangeElement(change).type.elemID.getFullName()) ?? [])
      .filter(
        ([_id, typeChange]) => isDependentAction(change.action, typeChange.action)
      )
      .map(
        ([typeChangeId, typeChange]) => addReferenceDependency(typeChange.action, id, typeChangeId)
      )
  )

  return wu(changes)
    .filter(isFieldOrInstanceChange)
    .map(addChangeTypeDependency)
    .flatten()
}
