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
  isAdditionOrRemovalChange,
  isInstanceChange,
  isRemovalChange,
} from '@salto-io/adapter-api'
import { getParent, hasValidParent } from '@salto-io/adapter-utils'
import { deployment } from '@salto-io/adapter-components'
import _ from 'lodash'
import { FIELD_CONTEXT_TYPE_NAME } from '../filters/fields/constants'

export const globalFieldContextsDependencyChanger: DependencyChanger = async changes => {
  const globalContextChanges = Array.from(changes.entries())
    .map(([key, change]) => ({ key, change }))
    .filter((change): change is deployment.dependency.ChangeWithKey<Change<InstanceElement>> =>
      isInstanceChange(change.change),
    )
    .filter(({ change }) => getChangeData(change).elemID.typeName === FIELD_CONTEXT_TYPE_NAME)
    .filter(({ change }) => isAdditionOrRemovalChange(change))
    .filter(
      ({ change }) =>
        _.isEmpty(getChangeData(change).value.projectIds) || _.isEmpty(getChangeData(change).value.issueTypeIds),
    )

  const filteredGlobalContextChanges = globalContextChanges.filter(({ change }) =>
    hasValidParent(getChangeData(change)),
  )

  const fieldToContexts = _.groupBy(filteredGlobalContextChanges, ({ change }) =>
    getParent(getChangeData(change)).elemID.getFullName(),
  )

  return Object.values(fieldToContexts).flatMap(contextsGroup => {
    const removalChanges = contextsGroup.filter(({ change }) => isRemovalChange(change))
    const additionChanges = contextsGroup.filter(({ change }) => isAdditionChange(change))

    return additionChanges.flatMap(additionChange =>
      removalChanges.map(removalChange => dependencyChange('add', additionChange.key, removalChange.key)),
    )
  })
}
