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
import { BuiltinTypes, ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { CUSTOM_RECORDS_PATH, CUSTOM_RECORD_TYPE, INTERNAL_ID, METADATA_TYPE, NETSUITE, SCRIPT_ID } from '../../src/constants'
import { customrecordtypeType } from '../../src/autogen/types/standard_types/customrecordtype'
import { createCustomRecordTypes, toCustomRecordTypeInstance } from '../../src/custom_records/custom_record_type'

describe('custom record type transformer', () => {
  describe('createCustomRecordTypes', () => {
    it('should create custom record type from instance', async () => {
      const { type } = customrecordtypeType()
      const instance = new InstanceElement(
        'instance',
        type,
        {
          [SCRIPT_ID]: 'customrecord1',
        }
      )
      const [customRecordType] = createCustomRecordTypes([instance], type)
      expect(customRecordType.elemID.name).toEqual('customrecord1')
      expect(customRecordType.annotations).toEqual({
        [METADATA_TYPE]: 'customrecordtype',
        scriptid: 'customrecord1',
        source: 'soap',
      })
      expect(Object.keys(customRecordType.annotationRefTypes))
        .toEqual(Object.keys(type.fields).concat('source'))
      expect(Object.keys(customRecordType.fields)).toEqual([SCRIPT_ID, INTERNAL_ID, 'translationsList'])
      expect(customRecordType.path).toEqual([NETSUITE, CUSTOM_RECORDS_PATH, 'customrecord1'])
    })
  })
  describe('toCustomRecordTypeInstance', () => {
    it('should transform custom record type to customrecordtype instance', () => {
      const instance = toCustomRecordTypeInstance(new ObjectType({
        elemID: new ElemID(NETSUITE, 'customrecord1'),
        fields: {
          custom_field: {
            refType: BuiltinTypes.STRING,
            annotations: {
              [SCRIPT_ID]: 'custom_field',
              index: 0,
            },
          },
        },
        annotations: {
          [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
          source: 'soup',
          [SCRIPT_ID]: 'customrecord1',
        },
      }))
      expect(instance.elemID.typeName).toEqual(CUSTOM_RECORD_TYPE)
      expect(instance.elemID.name).toEqual('customrecord1')
      expect(instance.value).toEqual({
        [SCRIPT_ID]: 'customrecord1',
        customrecordcustomfields: {
          customrecordcustomfield: [
            { [SCRIPT_ID]: 'custom_field' },
          ],
        },
      })
    })
    it('should keep the right order of custom fields', () => {
      const instance = toCustomRecordTypeInstance(new ObjectType({
        elemID: new ElemID(NETSUITE, 'customrecord1'),
        fields: {
          custom_second_field: {
            refType: BuiltinTypes.STRING,
            annotations: {
              [SCRIPT_ID]: 'custom_second_field',
              index: 1,
            },
          },
          custom_first_field: {
            refType: BuiltinTypes.STRING,
            annotations: {
              [SCRIPT_ID]: 'custom_first_field',
              index: 0,
            },
          },
        },
        annotations: {
          [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
          source: 'soup',
          [SCRIPT_ID]: 'customrecord1',
        },
      }))
      expect(instance.elemID.typeName).toEqual(CUSTOM_RECORD_TYPE)
      expect(instance.elemID.name).toEqual('customrecord1')
      expect(instance.value).toEqual({
        [SCRIPT_ID]: 'customrecord1',
        customrecordcustomfields: {
          customrecordcustomfield: [
            { [SCRIPT_ID]: 'custom_first_field' },
            { [SCRIPT_ID]: 'custom_second_field' },
          ],
        },
      })
    })
  })
})
