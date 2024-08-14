/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import {
  CUSTOM_RECORDS_PATH,
  CUSTOM_RECORD_TYPE,
  INTERNAL_ID,
  METADATA_TYPE,
  NETSUITE,
  SCRIPT_ID,
} from '../../src/constants'
import { customrecordtypeType } from '../../src/autogen/types/standard_types/customrecordtype'
import { createCustomRecordTypes, toCustomRecordTypeInstance } from '../../src/custom_records/custom_record_type'

describe('custom record type transformer', () => {
  describe('createCustomRecordTypes', () => {
    it('should create custom record type from instance', async () => {
      const { type } = customrecordtypeType()
      const instance = new InstanceElement('instance', type, {
        [SCRIPT_ID]: 'customrecord1',
      })
      const [customRecordType] = createCustomRecordTypes([instance], type)
      expect(customRecordType.elemID.name).toEqual('customrecord1')
      expect(customRecordType.annotations).toEqual({
        [METADATA_TYPE]: 'customrecordtype',
        scriptid: 'customrecord1',
        source: 'soap',
      })
      expect(Object.keys(customRecordType.annotationRefTypes)).toEqual(
        Object.keys(type.fields).concat('source', 'internalId'),
      )
      expect(Object.keys(customRecordType.fields)).toEqual([SCRIPT_ID, INTERNAL_ID, 'translationsList'])
      expect(customRecordType.path).toEqual([NETSUITE, CUSTOM_RECORDS_PATH, 'customrecord1'])
    })
  })
  describe('toCustomRecordTypeInstance', () => {
    it('should transform custom record type to customrecordtype instance', () => {
      const instance = toCustomRecordTypeInstance(
        new ObjectType({
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
            [CORE_ANNOTATIONS.CHANGED_AT]: '2023-02-02T10:52:20Z',
            [CORE_ANNOTATIONS.CHANGED_BY]: 'Salto User',
            source: 'soup',
            [SCRIPT_ID]: 'customrecord1',
          },
        }),
      )
      expect(instance.elemID.typeName).toEqual(CUSTOM_RECORD_TYPE)
      expect(instance.elemID.name).toEqual('customrecord1')
      expect(instance.value).toEqual({
        [SCRIPT_ID]: 'customrecord1',
        customrecordcustomfields: {
          customrecordcustomfield: [{ [SCRIPT_ID]: 'custom_field' }],
        },
      })
    })
    it('should keep the right order of custom fields', () => {
      const instance = toCustomRecordTypeInstance(
        new ObjectType({
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
            [CORE_ANNOTATIONS.CHANGED_AT]: '2023-02-02T10:52:20Z',
            [CORE_ANNOTATIONS.CHANGED_BY]: 'Salto User',
            source: 'soup',
            [SCRIPT_ID]: 'customrecord1',
          },
        }),
      )
      expect(instance.elemID.typeName).toEqual(CUSTOM_RECORD_TYPE)
      expect(instance.elemID.name).toEqual('customrecord1')
      expect(instance.value).toEqual({
        [SCRIPT_ID]: 'customrecord1',
        customrecordcustomfields: {
          customrecordcustomfield: [{ [SCRIPT_ID]: 'custom_first_field' }, { [SCRIPT_ID]: 'custom_second_field' }],
        },
      })
    })
  })
})
