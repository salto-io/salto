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

import _ from 'lodash'
import { logger } from '@salto-io/logging'
import {
  DependencyChanger,
  InstanceElement,
  ModificationChange,
  dependencyChange,
  getChangeData,
  isInstanceChange,
  isModificationChange,
} from '@salto-io/adapter-api'
import { deployment } from '@salto-io/adapter-components'
import { values } from '@salto-io/lowerdash'
import { getParent } from '@salto-io/adapter-utils'
import { APPLICATION_TYPE_NAME, APP_GROUP_ASSIGNMENT_TYPE_NAME } from '../constants'

const log = logger(module)

/*
 * Add dependency from ApplicationGroupAssignment change to Application modification change.
 * Application modification change must be deployed before its ApplicationGroupAssignment changes
 */
export const addAppGroupToAppDependency: DependencyChanger = async changes => {
  const instanceChanges = Array.from(changes.entries())
    .map(([key, change]) => ({ key, change }))
    .filter((change): change is deployment.dependency.ChangeWithKey<ModificationChange<InstanceElement>> =>
      isInstanceChange(change.change),
    )

  const appModificationChanges = instanceChanges
    .filter(change => isModificationChange(change.change))
    .filter(change => getChangeData(change.change).elemID.typeName === APPLICATION_TYPE_NAME)

  const appModificationByAppName = _.keyBy(appModificationChanges, change =>
    getChangeData(change.change).elemID.getFullName(),
  )

  const appGroupChanges = instanceChanges.filter(
    change => getChangeData(change.change).elemID.typeName === APP_GROUP_ASSIGNMENT_TYPE_NAME,
  )

  if (_.isEmpty(appModificationChanges) || _.isEmpty(appGroupChanges)) {
    return []
  }

  return appGroupChanges
    .map(appGroupChange => {
      try {
        const parentApp = getParent(getChangeData(appGroupChange.change))
        const parentAppChange = appModificationByAppName[parentApp.elemID.getFullName()]
        if (parentAppChange === undefined) {
          return undefined
        }
        return dependencyChange('add', appGroupChange.key, parentAppChange.key)
      } catch (err) {
        log.error('Failed to add dependency from ApplicationGroupAssignment to Application: %s', err)
        return undefined
      }
    })
    .filter(values.isDefined)
}
