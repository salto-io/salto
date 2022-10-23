/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { isObjectType, ObjectType } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { FilterWith, LocalFilterCreator } from '../filter'
import { isCustomMetadataRecordType } from './utils'
import {
  CUSTOM_METADATA, FIELD_ANNOTATIONS,
  METADATA_TYPE,
  SALESFORCE_CUSTOM_SUFFIX,
} from '../constants'

const { awu } = collections.asynciterable

const setCustomFieldsAsModifiable = (customMetadataType: ObjectType): void => {
  Object.values(customMetadataType.fields)
    .filter(field => field.name.endsWith(SALESFORCE_CUSTOM_SUFFIX))
    .forEach(field => {
      field.annotations[FIELD_ANNOTATIONS.CREATABLE] = true
      field.annotations[FIELD_ANNOTATIONS.UPDATEABLE] = true
    })
}

const filterCreator: LocalFilterCreator = () : FilterWith<'onFetch'> => ({
  onFetch: async elements => {
    await awu(elements)
      .filter(isObjectType)
      .filter(isCustomMetadataRecordType)
      .forEach(customMetadataRecordType => {
        // Fixing the type from CustomObject to CustomMetadata
        customMetadataRecordType.annotations[METADATA_TYPE] = CUSTOM_METADATA
        setCustomFieldsAsModifiable(customMetadataRecordType)
      })
  },
})

export default filterCreator
