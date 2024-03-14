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
  DependencyChange,
  DependencyChanger,
  InstanceElement,
  RemovalChange
  dependencyChange,
  getChangeData,
  isInstanceChange,
  isRemovalChange,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { deployment } from '@salto-io/adapter-components'
import { PROFILE_MAPPING_TYPE_NAME } from '../constants'
import { isActivationChange } from '../deployment'
import { getParentApp } from '../change_validators/app_schema_with_inactive_app'
import profile_mapping_removal from '../filters/profile_mapping_removal'

export const removeProfileMappingAfterDeps: DependencyChanger = async changes => {
  // Find all ProfileMapping removal changes
  const removals = Array.from(changes.entries())
    .map(([key, change]) => ({ key, change }))
    .filter(({ change }) => isRemovalChange(change))
    .filter((change): change is deployment.dependency.ChangeWithKey<RemovalChange<InstanceElement>> =>
      isInstanceChange(change.change),
    )

  const elemIDToRemoval = Object.fromEntries(removals.map(
    change => [getChangeData(change.change).elemID.getFullName(), change]
  ))

  const profileMappingRemovals = removals
    .filter(change => getChangeData(change.change).elemID.typeName === PROFILE_MAPPING_TYPE_NAME)
    .map(change => {

    })

  return profileMappingRemovals.flatMap(change => {
    const { source, target } = getChangeData(change).value

    if (appChange === undefined) {
      return []
    }
    return createDependencyChange(change, appChange)
  }


}
