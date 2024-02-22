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
import { collections } from '@salto-io/lowerdash'
import { BuiltinTypes, ElemID, isObjectType, ObjectType, ReadOnlyElementsSource } from '@salto-io/adapter-api'
import { LocalFilterOpts } from '../../src/filter'
import { CUSTOM_RECORD_TYPE, METADATA_TYPE, NETSUITE, SCRIPT_ID } from '../../src/constants'
import filterCreator from '../../src/filters/custom_record_types'
import { LazyElementsSourceIndexes } from '../../src/elements_source_index/types'
import { emptyQueryParams } from '../../src/config/config_creator'

const { awu } = collections.asynciterable

describe('custom record types filter', () => {
  let customRecordType: ObjectType
  let customRecordFieldRefType: ObjectType
  let dataType: ObjectType

  const filterOpts = {
    config: { fetch: { include: { types: [{ name: '.*' }], fileCabinet: ['.*'] }, exclude: emptyQueryParams() } },
    isPartial: false,
    elementsSourceIndex: {
      getIndexes: () => {
        throw new Error('should not call getIndexes')
      },
    },
    elementsSource: {
      list: () => {
        throw new Error('should not call elementsSource.list')
      },
    },
  } as unknown as LocalFilterOpts

  beforeEach(() => {
    customRecordType = new ObjectType({
      elemID: new ElemID(NETSUITE, 'customrecord1'),
      annotations: {
        scriptid: 'customrecord1',
        customrecordcustomfields: {
          customrecordcustomfield: [
            {
              scriptid: 'custrecord_newfield',
              fieldtype: 'TEXT',
            },
            {
              scriptid: 'custrecord_ref',
              fieldtype: 'SELECT',
              selectrecordtype: `[${SCRIPT_ID}=customrecord2]`,
            },
            {
              scriptid: 'custrecord_account',
              fieldtype: 'SELECT',
              selectrecordtype: '-112',
            },
          ],
        },
        instances: [1, 2, 3],
        [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
      },
    })
    customRecordFieldRefType = new ObjectType({
      elemID: new ElemID(NETSUITE, 'customrecord2'),
      annotations: {
        scriptid: 'customrecord2',
        [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
      },
    })
    dataType = new ObjectType({
      elemID: new ElemID(NETSUITE, 'account'),
    })
  })
  it('should add fields to type', async () => {
    await filterCreator(filterOpts).onFetch?.([customRecordType, customRecordFieldRefType, dataType])
    expect(Object.keys(customRecordType.fields)).toEqual([
      'custom_custrecord_newfield',
      'custom_custrecord_ref',
      'custom_custrecord_account',
    ])
    expect(customRecordType.fields.custom_custrecord_newfield.refType.elemID.name).toEqual(
      BuiltinTypes.STRING.elemID.name,
    )
    expect(customRecordType.fields.custom_custrecord_newfield.annotations).toEqual({
      scriptid: 'custrecord_newfield',
      fieldtype: 'TEXT',
      index: 0,
    })
    expect(customRecordType.fields.custom_custrecord_ref.refType.elemID.name).toEqual('customrecord2')
    expect(customRecordType.fields.custom_custrecord_ref.annotations).toEqual({
      scriptid: 'custrecord_ref',
      fieldtype: 'SELECT',
      selectrecordtype: `[${SCRIPT_ID}=customrecord2]`,
      index: 1,
    })
    expect(customRecordType.fields.custom_custrecord_account.refType.elemID.name).toEqual('account')
    expect(customRecordType.fields.custom_custrecord_account.annotations).toEqual({
      scriptid: 'custrecord_account',
      fieldtype: 'SELECT',
      selectrecordtype: '-112',
      index: 2,
    })
  })
  it('should add fields correctly on partial fetch', async () => {
    await filterCreator({
      ...filterOpts,
      isPartial: true,
      elementsSourceIndex: {
        getIndexes: () =>
          Promise.resolve({
            serviceIdRecordsIndex: {
              customrecord2: {
                elemID: new ElemID(NETSUITE, 'customrecord2', 'attr', 'scriptid'),
                serviceID: 'customrecord2',
              },
            },
          }),
      } as unknown as LazyElementsSourceIndexes,
      elementsSource: {
        list: async () => awu([dataType.elemID]),
      } as unknown as ReadOnlyElementsSource,
    }).onFetch?.([customRecordType])
    const field1refType = await customRecordType.fields.custom_custrecord_ref.getType()
    expect(isObjectType(field1refType) && field1refType.isEqual(customRecordFieldRefType)).toBeTruthy()
    const field2refType = await customRecordType.fields.custom_custrecord_account.getType()
    expect(field2refType.elemID.isEqual(dataType.elemID)).toBeTruthy()
  })
  it('should remove custom fields annotation', async () => {
    await filterCreator(filterOpts).onFetch?.([customRecordType])
    expect(customRecordType.annotations.customrecordcustomfields).toBeUndefined()
  })
  it('should not remove instances annotation if there are no custom record instances', async () => {
    await filterCreator(filterOpts).onFetch?.([customRecordType])
    expect(customRecordType.annotations.instances).toEqual([1, 2, 3])
  })
  it('should remove instances annotation if custom records fetch is enabled in the adapter config', async () => {
    await filterCreator({
      ...filterOpts,
      config: {
        fetch: {
          include: {
            types: [],
            fileCabinet: [],
            customRecords: [{ name: customRecordType.elemID.name }],
          },
          exclude: {
            types: [],
            fileCabinet: [],
            customRecords: [],
          },
        },
      },
    }).onFetch?.([customRecordType])
    expect(customRecordType.annotations.instances).toBeUndefined()
  })
})
