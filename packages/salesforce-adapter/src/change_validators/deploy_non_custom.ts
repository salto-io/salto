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
  ChangeError,
  ChangeValidator,
  getChangeData,
  isFieldChange,
  isObjectTypeChange,
  ObjectType,
} from '@salto-io/adapter-api'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { values } from '@salto-io/lowerdash'
import { apiNameSync, isCustomObjectSync } from '../filters/utils'

const { isDefined } = values

const log = logger(module)

const createNonDeployableTypeError = (objectType: ObjectType): ChangeError => ({
  elemID: objectType.elemID,
  message: 'Deploying a non-deployable type',
  detailedMessage: `The type ${apiNameSync(objectType)} is not a custom type and can't be deployed`,
  severity: 'Error',
})

const getAffectedType = (change: Change): ObjectType | undefined => {
  if (isObjectTypeChange(change)) {
    return getChangeData(change)
  }
  if (isFieldChange(change)) {
    return getChangeData(change).parent
  }

  return undefined
}

const changeValidator: ChangeValidator = async (changes) =>
  changes
    .filter((change) => {
      log.info('Validating change %s', safeJsonStringify(change))
      return true
    })
    .map((change) => getAffectedType(change))
    .filter(isDefined)
    .filter((objectType) => !isCustomObjectSync(objectType))
    .filter((objectType) => {
      log.info('Invalid change! %s', safeJsonStringify(objectType))
      return true
    })
    .map(createNonDeployableTypeError)

export default changeValidator
