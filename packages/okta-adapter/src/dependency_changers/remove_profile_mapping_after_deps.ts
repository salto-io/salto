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
  DependencyChanger,
  InstanceElement,
  RemovalChange,
  dependencyChange,
  getChangeData,
  isInstanceChange,
  isRemovalChange,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { deployment } from '@salto-io/adapter-components'
import { PROFILE_MAPPING_TYPE_NAME } from '../constants'

/**
 * Remove ProfileMapping only *after* one of its dependencies is removed.
 *
 * ProfileMappings have a reference to source and target, so there will be an existing reference dependency -
 * remove it and add the reverse dependency.
 */
export const removeProfileMappingAfterDeps: DependencyChanger = async changes => {
  const removals = Array.from(changes.entries())
    .map(([key, change]) => ({ key, change }))
    .filter(({ change }) => isRemovalChange(change))
    .filter((change): change is deployment.dependency.ChangeWithKey<RemovalChange<InstanceElement>> =>
      isInstanceChange(change.change),
    )

  const profileMappingRemovals = removals.filter(
    change => getChangeData(change.change).elemID.typeName === PROFILE_MAPPING_TYPE_NAME,
  )

  return profileMappingRemovals.flatMap(profileMappingRemoval => {
    const { source, target } = getChangeData(profileMappingRemoval.change).value
    return removals
      .filter(removal => {
        const removalName = getChangeData(removal.change).elemID.getFullName()
        return (
          (isReferenceExpression(source?.id) && source.id.elemID.getFullName() === removalName) ||
          (isReferenceExpression(target?.id) && target.id.elemID.getFullName() === removalName)
        )
      })
      .map(depRemoval => [
        dependencyChange('remove', depRemoval.key, profileMappingRemoval.key),
        dependencyChange('add', profileMappingRemoval.key, depRemoval.key),
      ])
      .flat()
  })
}
