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
import { getParent } from '@salto-io/adapter-utils'
import { USERTYPE_TYPE_NAME, USER_SCHEMA_TYPE_NAME } from '../constants'

const log = logger(module)

/**
 * When removing UserSchema, validate the parent UserType gets removed as well
 */
export const userTypeAndSchemaValidator: ChangeValidator = async changes => {
  const removalInstanceChanges = changes.filter(isInstanceChange).filter(isRemovalChange).map(getChangeData)

  const removedUserSchemaInstances = removalInstanceChanges.filter(
    instance => instance.elemID.typeName === USER_SCHEMA_TYPE_NAME,
  )

  const removedUserTypeNames = new Set(
    removalInstanceChanges
      .filter(instance => instance.elemID.typeName === USERTYPE_TYPE_NAME)
      .map(instance => instance.elemID.getFullName()),
  )

  return removedUserSchemaInstances
    .filter(userSchema => {
      try {
        return !removedUserTypeNames.has(getParent(userSchema).elemID.getFullName())
      } catch (e) {
        log.error(
          `Could not run userTypeAndSchemaValidator validator for instance ${userSchema.elemID.getFullName}: ${e}`,
        )
        return false
      }
    })
    .map(userSchema => ({
      elemID: userSchema.elemID,
      severity: 'Error',
      message: 'Cannot remove user schema without its parent user type',
      detailedMessage: `In order to remove ${userSchema.elemID.name}, the instance ${getParent(userSchema).elemID.name} of type ${USERTYPE_TYPE_NAME} must be removed as well.`,
    }))
}
