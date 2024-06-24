/*
 *                      Copyright 2024 Salto Labs Ltd.
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
  DependencyChange,
  isInstanceChangeEntry,
  InstanceElement,
  ChangeEntry,
  DependencyChanger,
  getChangeData,
  isField,
  isDependentAction,
  addReferenceDependency,
} from '@salto-io/adapter-api'

const { awu } = collections.asynciterable

export const addInstanceToFieldsDependency: DependencyChanger = async changes => {
  const fieldChanges = collections.iterable.groupBy(
    wu(changes).filter(([_id, change]) => isField(getChangeData(change))),
    ([_id, change]) => getChangeData(change).elemID.getFullName(),
  )

  const addChangeFieldDependency = async ([id, change]: ChangeEntry<InstanceElement>): Promise<DependencyChange[]> => {
    const fieldsElemIDs = Object.values((await getChangeData(change).getType()).fields).map(field =>
      field.elemID.getFullName(),
    )
    return fieldsElemIDs
      .flatMap(fieldName => fieldChanges.get(fieldName) ?? [])
      .filter(([_id, fieldChange]) => isDependentAction(change.action, fieldChange.action))
      .map(([fieldChangeId, fieldChange]) => addReferenceDependency(fieldChange.action, id, fieldChangeId))
  }

  return awu(changes).filter(isInstanceChangeEntry).flatMap(addChangeFieldDependency).toArray()
}
