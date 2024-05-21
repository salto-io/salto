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
  ChangeError,
  ChangeValidator,
  Field,
  getChangeData,
  isAdditionChange,
  isFieldChange,
  isObjectType,
  ObjectType,
} from '@salto-io/adapter-api'
import { isCustom } from '../transformers/transformer'
import { apiNameSync, getFLSProfiles } from '../filters/utils'
import { SalesforceConfig } from '../types'

const profileNameOrNumberOfProfiles = (profiles: string[]): string =>
  profiles.length === 1
    ? `the following profile: ${profiles[0]}`
    : `${profiles.length} profiles`

const createObjectFLSInfo = (
  field: ObjectType,
  flsProfiles: string[],
): ChangeError => ({
  message: `Read/write access to this Custom Object will be granted to ${profileNameOrNumberOfProfiles(flsProfiles)}`,
  detailedMessage: `Deploying this new Custom Object will make it and it's Custom Fields accessible by the following Profiles: [${flsProfiles.join(', ')}].`,
  severity: 'Info',
  elemID: field.elemID,
})

const createFieldFLSInfo = (
  field: Field,
  flsProfiles: string[],
): ChangeError => ({
  message: `Read/write access to this Custom Field will be granted to ${profileNameOrNumberOfProfiles(flsProfiles)}`,
  detailedMessage: `Deploying this new Custom Field will make it accessible by the following Profiles: [${flsProfiles.join(', ')}].`,
  severity: 'Info',
  elemID: field.elemID,
})

const changeValidator =
  (config: SalesforceConfig): ChangeValidator =>
  async (changes) => {
    const flsProfiles = getFLSProfiles(config)

    const addedCustomObjects = changes
      .filter(isAdditionChange)
      .map(getChangeData)
      .filter(isObjectType)
      .filter((objectType) => isCustom(apiNameSync(objectType)))
    const addedCustomObjectsApiNames = new Set(
      addedCustomObjects.map((customObject) => apiNameSync(customObject)),
    )
    const addedCustomObjectsInfos = addedCustomObjects.map((customObject) =>
      createObjectFLSInfo(customObject, flsProfiles),
    )
    const addedCustomFieldsInfos = changes
      .filter(isAdditionChange)
      .filter(isFieldChange)
      .map(getChangeData)
      // Do not create FLS info on fields that are part of a new custom object
      .filter(
        (field) => !addedCustomObjectsApiNames.has(apiNameSync(field.parent)),
      )
      .map((field) => createFieldFLSInfo(field, flsProfiles))

    return [...addedCustomFieldsInfos, ...addedCustomObjectsInfos]
  }

export default changeValidator
