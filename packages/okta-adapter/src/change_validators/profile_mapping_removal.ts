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

import { ChangeValidator, getChangeData, isInstanceChange, isRemovalChange } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { PROFILE_MAPPING_TYPE_NAME } from '../constants'

const log = logger(module)

/**
 * When removing a Profile Mapping, validate that either its source or targat are also removed.
 */
export const profileMappingRemovalValidator: ChangeValidator = async changes => {
  const removeInstanceChanges = changes.filter(isInstanceChange).filter(isRemovalChange).map(getChangeData)

  const removedProfileMappingInstances = removeInstanceChanges.filter(
    instance => instance.elemID.typeName === PROFILE_MAPPING_TYPE_NAME,
  )

  const removedNames = new Set(removeInstanceChanges.map(instance => instance.elemID.getFullName()))

  return removedProfileMappingInstances
    .filter(profileMapping => {
      try {
        return !(
          removedNames.has(profileMapping.value.source?.elemID.getFullName()) ||
          removedNames.has(profileMapping.value.target?.elemID.getFullName())
        )
      } catch (e) {
        log.error(
          'Could not run profileMappingAndAppValidator validator for instance ' +
            `${profileMapping.elemID.getFullName}: ${e}`,
        )
        return false
      }
    })
    .map(profileMapping => ({
      elemID: profileMapping.elemID,
      severity: 'Error',
      message: 'Cannot remove profile mapping if neither its source nor target are also removed',
      detailedMessage:
        `In order to remove ${profileMapping.elemID.name}, either its source (instance ` +
        `${profileMapping.value.source?.elemID.name} of type ${profileMapping.value.source?.elemID.typeName})` +
        ` or target (instance ${profileMapping.value.target?.elemID.name} of type` +
        ` ${profileMapping.value.target?.elemID.typeName}) must be removed as well.`,
    }))
}
