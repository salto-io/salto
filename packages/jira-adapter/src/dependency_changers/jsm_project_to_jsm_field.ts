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
  AdditionChange,
  DependencyChange,
  DependencyChanger,
  InstanceElement,
  dependencyChange,
  getChangeData,
  isAdditionChange,
  isInstanceChange,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { deployment } from '@salto-io/adapter-components'
import { PROJECT_TYPE, SERVICE_DESK } from '../constants'
import { FIELD_TYPE_NAME } from '../filters/fields/constants'

const createDependencyChange = (
  jsmProjectChange: deployment.dependency.ChangeWithKey<AdditionChange<InstanceElement>>,
  jsmFieldChange: deployment.dependency.ChangeWithKey<AdditionChange<InstanceElement>>,
): DependencyChange[] => [dependencyChange('add', jsmFieldChange.key, jsmProjectChange.key)]

/*
 * This dependency changer is used to add a dependency from jsm project to field
 * because we need the project to be deployed before the field.
 * In order to create all the default fields.
 */
export const jsmProjectToJsmFieldDependencyChanger: DependencyChanger = async changes => {
  const instanceChanges = Array.from(changes.entries())
    .map(([key, change]) => ({ key, change }))
    .filter(({ change }) => isAdditionChange(change))
    .filter((change): change is deployment.dependency.ChangeWithKey<AdditionChange<InstanceElement>> =>
      isInstanceChange(change.change),
    )
  const relevantChanges = instanceChanges.filter(change =>
    [PROJECT_TYPE, FIELD_TYPE_NAME].includes(getChangeData(change.change).elemID.typeName),
  )

  const [projectChanges, fieldChanges] = _.partition(
    relevantChanges,
    change => getChangeData(change.change).elemID.typeName === PROJECT_TYPE,
  )
  const jsmProjects = projectChanges.filter(
    change => getChangeData(change.change).value.projectTypeKey === SERVICE_DESK,
  )
  const jsmFields = fieldChanges.filter(change => getChangeData(change.change).value.type?.includes('service'))

  if (_.isEmpty(jsmProjects) || _.isEmpty(jsmFields)) {
    return []
  }
  return jsmProjects.flatMap(change => {
    const jsmProjectChange = change as deployment.dependency.ChangeWithKey<AdditionChange<InstanceElement>>
    return jsmFields.map(fieldChange => createDependencyChange(jsmProjectChange, fieldChange)).flat()
  })
}
