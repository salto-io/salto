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
import { values } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { apiNameSync, metadataTypeSync } from '../filters/utils'
import { API_NAME, CUSTOM_OBJECT, METADATA_TYPE } from '../constants'

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

const isMetadataType = (objectType: ObjectType): boolean =>
  objectType.annotations[METADATA_TYPE] !== undefined && // this is how we identify artificial types
  (metadataTypeSync(objectType) !== CUSTOM_OBJECT ||
    objectType.annotations[API_NAME] === undefined) // the original "CustomObject" type from salesforce will not have an API_NAME

const changeValidator: ChangeValidator = async (changes) =>
  changes
    .map((change) => getAffectedType(change))
    .filter(isDefined)
    .filter(isMetadataType)
    .filter((objectType) => {
      log.info('Invalid object type %o', {
        elemID: objectType.elemID.getFullName(),
        metadataType: objectType.annotations[METADATA_TYPE],
        apiName: objectType.annotations[API_NAME],
      })
      return true
    })
    .map(createNonDeployableTypeError)

export default changeValidator
