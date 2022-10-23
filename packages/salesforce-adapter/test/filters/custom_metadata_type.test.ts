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


import { BuiltinTypes, ElemID, ObjectType } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/custom_metadata_type'
import { defaultFilterContext } from '../utils'
import {
  API_NAME,
  CUSTOM_METADATA, FIELD_ANNOTATIONS,
  METADATA_TYPE,
  SALESFORCE,
} from '../../src/constants'
import { FilterWith } from '../../src/filter'

describe('customMetadataTypeFilter', () => {
  const CUSTOM_METADATA_RECORD_TYPE_NAME = 'MDType__mdt'
  const filter = (): FilterWith<'onFetch' | 'preDeploy'> => filterCreator({
    config: defaultFilterContext,
  }) as FilterWith<'onFetch' | 'preDeploy'>

  describe('onFetch', () => {
    let customMetadataRecordType: ObjectType
    beforeEach(async () => {
      customMetadataRecordType = new ObjectType({
        elemID: new ElemID(SALESFORCE, CUSTOM_METADATA_RECORD_TYPE_NAME),
        fields: {
          customField__c: { refType: BuiltinTypes.NUMBER },
        },
        annotations: {
          [API_NAME]: CUSTOM_METADATA_RECORD_TYPE_NAME,
        },
      })
      const elements = [customMetadataRecordType]
      await filter().onFetch(elements)
    })
    it('should change the CustomMetadataRecordType metadata type to "CustomMetadata"', () => {
      expect(customMetadataRecordType.annotations[METADATA_TYPE]).toEqual(CUSTOM_METADATA)
    })
    it('should make the custom field modifiable', () => {
      const customField = customMetadataRecordType.fields.customField__c
      expect(customField).toBeDefined()
      expect(customField.annotations).toContainAllEntries([
        [FIELD_ANNOTATIONS.CREATABLE, true],
        [FIELD_ANNOTATIONS.UPDATEABLE, true],
      ])
    })
  })
})
