/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ChangeError,
  ChangeValidator,
  Field,
  getChangeData,
  isAdditionChange,
  isFieldChange,
  isObjectType,
  ObjectType,
} from '@salto-io/adapter-api'
import {
  apiNameSync,
  getFLSProfiles,
  isCustomMetadataRecordTypeSync,
  isCustomObjectSync,
  isStandardObjectSync,
} from '../filters/utils'
import { SalesforceConfig } from '../types'

const profileNameOrNumberOfProfiles = (profiles: string[]): string =>
  profiles.length === 1 ? `the following profile: ${profiles[0]}` : `${profiles.length} profiles`

const createObjectFLSInfo = (field: ObjectType, flsProfiles: string[]): ChangeError => ({
  message: `Read/write access to this Custom Object will be granted to ${profileNameOrNumberOfProfiles(flsProfiles)}`,
  detailedMessage: `Deploying this new Custom Object will make it and its Custom Fields accessible by the following Profiles: [${flsProfiles.join(', ')}].`,
  severity: 'Info',
  elemID: field.elemID,
})

const createFieldFLSInfo = (field: Field, flsProfiles: string[]): ChangeError => ({
  message: `Read/write access to this Custom Field will be granted to ${profileNameOrNumberOfProfiles(flsProfiles)}`,
  detailedMessage: `Deploying this new Custom Field will make it accessible by the following Profiles: [${flsProfiles.join(', ')}].`,
  severity: 'Info',
  elemID: field.elemID,
})

const changeValidator =
  (config: SalesforceConfig): ChangeValidator =>
  async changes => {
    const flsProfiles = getFLSProfiles(config)

    // CustomObjects and CustomMetadata types
    const addedCustomObjects = changes
      .filter(isAdditionChange)
      .map(getChangeData)
      .filter(isObjectType)
      // Additions of Standard Objects are invalid and should be handled as part of the standardFieldOrObjectAdditionsOrDeletions Change Validator
      .filter(
        objectType =>
          isCustomMetadataRecordTypeSync(objectType) ||
          (isCustomObjectSync(objectType) && !isStandardObjectSync(objectType)),
      )
    const addedCustomObjectsApiNames = new Set(addedCustomObjects.map(customObject => apiNameSync(customObject)))
    const addedCustomObjectsInfos = addedCustomObjects.map(customObject =>
      createObjectFLSInfo(customObject, flsProfiles),
    )
    const addedCustomFieldsInfos = changes
      .filter(isAdditionChange)
      .filter(isFieldChange)
      .map(getChangeData)
      // Do not create FLS info on fields that are part of a new custom object
      .filter(field => !addedCustomObjectsApiNames.has(apiNameSync(field.parent)))
      .map(field => createFieldFLSInfo(field, flsProfiles))

    return [...addedCustomFieldsInfos, ...addedCustomObjectsInfos]
  }

export default changeValidator
