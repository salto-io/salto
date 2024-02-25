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
import {
  Change,
  dependencyChange,
  DependencyChanger,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isInstanceChange,
  isRemovalChange,
} from '@salto-io/adapter-api'
import { deployment } from '@salto-io/adapter-components'
import _ from 'lodash'

export const projectDependencyChanger: DependencyChanger = async changes => {
  const projectChanges = Array.from(changes.entries())
    .map(([key, change]) => ({ key, change }))
    .filter((change): change is deployment.dependency.ChangeWithKey<Change<InstanceElement>> =>
      isInstanceChange(change.change),
    )
    .filter(({ change }) => getChangeData(change).elemID.typeName === 'Project')
    .filter(({ change }) => getChangeData(change).value.key !== undefined)

  const keyToProjects = _.groupBy(projectChanges, ({ change }) => getChangeData(change).value.key)

  return Object.values(keyToProjects).flatMap(projectChangesGroup => {
    const removalChanges = projectChangesGroup.filter(({ change }) => isRemovalChange(change))
    const additionChanges = projectChangesGroup.filter(({ change }) => isAdditionChange(change))

    return additionChanges.flatMap(additionChange =>
      removalChanges.map(removalChange => dependencyChange('add', additionChange.key, removalChange.key)),
    )
  })
}
