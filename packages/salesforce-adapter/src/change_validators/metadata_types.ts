/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
import { apiNameSync, metadataTypeSync } from '../filters/utils'
import { API_NAME, CUSTOM_METADATA, CUSTOM_OBJECT, CUSTOM_OBJECT_TYPE_NAME, METADATA_TYPE } from '../constants'

const { isDefined } = values

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

const isMetadataType = (objectType: ObjectType): boolean => {
  // Artificial Types
  if (objectType.annotations[METADATA_TYPE] === undefined) {
    return false
  }
  // CustomObject Metadata Type
  if (metadataTypeSync(objectType) === CUSTOM_OBJECT) {
    return objectType.elemID.typeName === CUSTOM_OBJECT_TYPE_NAME && objectType.annotations[API_NAME] === undefined
  }
  // CustomMetadata Metadata Type
  if (metadataTypeSync(objectType) === CUSTOM_METADATA) {
    return (
      objectType.annotations[API_NAME] === undefined // this would be the 'CustomObject' metadata type
    )
  }
  return true
}

const changeValidator: ChangeValidator = async changes =>
  changes
    .map(change => getAffectedType(change))
    .filter(isDefined)
    .filter(isMetadataType)
    .map(createNonDeployableTypeError)

export default changeValidator
