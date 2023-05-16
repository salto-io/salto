/*
*                      Copyright 2023 Salto Labs Ltd.
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

import { DependencyChange, DependencyChanger, InstanceElement, ModificationChange, dependencyChange, getChangeData, isInstanceChange, isModificationChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { getParent } from '@salto-io/adapter-utils'
import { APPLICATION_TYPE_NAME, APP_USER_SCHEMA_TYPE_NAME } from '../constants'
import { ChangeWithKey } from './types'
import { isActivationChange } from '../deployment'

const isRelevantChange = (change: ModificationChange<InstanceElement>): boolean => {
  const { typeName } = getChangeData(change).elemID
  return isModificationChange(change) && (typeName === APP_USER_SCHEMA_TYPE_NAME || typeName === APPLICATION_TYPE_NAME)
}

const createDependencyChange = (
  appUserSchemaChange: {key: collections.set.SetId; change: ModificationChange<InstanceElement>},
  appChanges: {key: collections.set.SetId; change: ModificationChange<InstanceElement>}[]
): DependencyChange[] => {
  const app = getParent(getChangeData(appUserSchemaChange.change))
  const appChange = appChanges.filter(change =>
    _.isEqual(getChangeData(change.change).elemID, app.elemID))
    .filter(change => isActivationChange({ before: change.change.data.before.value.status,
      after: change.change.data.after.value.status }))

  return appChange.flatMap(change => [dependencyChange(
    'add',
    appUserSchemaChange.key,
    change.key
  ),
  dependencyChange(
    'remove',
    change.key,
    appUserSchemaChange.key
  )])
}

export const changeDependenciesFromAppUserSchemaToApp: DependencyChanger = async changes => {
  const instanceChanges = Array.from(changes.entries())
    .map(([key, change]) => ({ key, change }))
    .filter(
      (change): change is ChangeWithKey<ModificationChange<InstanceElement>> =>
        isInstanceChange(change.change)
    )
    .filter(({ change }) => isModificationChange(change))

  const [appUserSchemasChanges, appsChanges] = _.partition(instanceChanges
    .filter(change => isRelevantChange(change.change)), change =>
    getChangeData(change.change).elemID.typeName === APP_USER_SCHEMA_TYPE_NAME)

  if (_.isEmpty(appUserSchemasChanges) || _.isEmpty(appsChanges)) {
    return []
  }
  return appUserSchemasChanges.flatMap(change => createDependencyChange(change, appsChanges))
}
