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
  ChangeValidator,
  getChangeData,
  isInstanceChange,
  isReferenceExpression,
  isRemovalChange,
} from '@salto-io/adapter-api'
import { PROFILE_MAPPING_TYPE_NAME } from '../constants'

/**
 * When removing a Profile Mapping, validate that either its source or target are also removed.
 *
 * Profile Mappings map profile fields between Okta user types and user profiles of external user providers connected
 * to Okta. For each pair of external user provider and Okta user type, there is _always_ a Profile Mapping instance -
 * it cannot be removed, and it is added with a default mapping value whenever a new external user provider or Okta user
 * types are added. When either side of the profile mapping is removed, the profile mapping is removed automatically.
 *
 * This change validator ensures that a profile mapping can be manually removed only if one of the mapping sides (source
 * or target) is also removed as part of the same deploy action.
 */
export const profileMappingRemovalValidator: ChangeValidator = async changes => {
  const removeInstanceChanges = changes.filter(isInstanceChange).filter(isRemovalChange).map(getChangeData)

  const removedProfileMappingInstances = removeInstanceChanges.filter(
    instance => instance.elemID.typeName === PROFILE_MAPPING_TYPE_NAME,
  )

  const removedNames = new Set(removeInstanceChanges.map(instance => instance.elemID.getFullName()))

  return removedProfileMappingInstances
    .filter(profileMapping => {
      const { source, target } = profileMapping.value
      return !(
        (isReferenceExpression(source?.id) && removedNames.has(source.id.elemID.getFullName())) ||
        (isReferenceExpression(target?.id) && removedNames.has(target.id.elemID.getFullName()))
      )
    })
    .map(profileMapping => {
      const { source, target } = profileMapping.value
      return {
        elemID: profileMapping.elemID,
        severity: 'Error',
        message: 'Cannot remove profile mapping if neither its source nor target are also removed',
        detailedMessage:
          'In order to remove this Profile Mapping, remove its' +
          ` source (${source?.id.elemID.typeName} ${source?.id.elemID.name}) or` +
          ` target (${target?.id.elemID.typeName} ${target?.id.elemID.name}) as well.`,
      }
    })
}
