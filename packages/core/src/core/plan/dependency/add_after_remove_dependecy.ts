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
  getChangeData,
  DependencyChanger,
  ChangeEntry,
  DependencyChange,
  dependencyChange,
} from '@salto-io/adapter-api'

export const addAfterRemoveDependency: DependencyChanger = async changes => {
  const removeChanges = collections.iterable.groupBy(
    wu(changes).filter(([_id, change]) => change.action === 'remove'),
    ([_id, change]) => getChangeData(change).elemID.getFullName(),
  )

  const addChangeDependency = ([id, change]: ChangeEntry): DependencyChange[] =>
    (removeChanges.get(getChangeData(change).elemID.getFullName()) ?? []).map(([removeChangeId]) =>
      dependencyChange('add', id, removeChangeId),
    )

  return wu(changes)
    .filter(([_id, change]) => change.action === 'add')
    .map(addChangeDependency)
    .flatten()
}
