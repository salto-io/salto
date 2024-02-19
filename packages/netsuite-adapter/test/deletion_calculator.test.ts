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
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import NetsuiteClient from '../src/client/client'
import { NetsuiteQuery } from '../src/config/query'
import { getDeletedElements } from '../src/deletion_calculator'
import { CUSTOM_RECORD_TYPE, METADATA_TYPE, NETSUITE, SCRIPT_ID } from '../src/constants'

describe('deletion calculator', () => {
  const mockRunSuiteQL = jest.fn()
  const client = {
    runSuiteQL: mockRunSuiteQL,
  } as unknown as NetsuiteClient

  const fetchQuery = {
    isTypeMatch: () => true,
    isCustomRecordTypeMatch: () => true,
    isCustomRecordMatch: () => true,
    isObjectMatch: () => true,
  } as unknown as NetsuiteQuery

  const DEFAULT_PARAMS = {
    client,
    fetchQuery,
    serviceInstanceIds: [],
    requestedCustomRecordTypes: [],
    serviceCustomRecords: [],
    requestedDataTypes: ['location'],
    serviceDataElements: [],
  }

  beforeEach(() => {
    mockRunSuiteQL.mockReset()
    mockRunSuiteQL.mockResolvedValueOnce([{ scriptid: 'customrecord1' }, { scriptid: 'customrecord2' }])
    mockRunSuiteQL.mockResolvedValueOnce([])
    mockRunSuiteQL.mockResolvedValueOnce([{ scriptid: 'custom_record_script_id' }])
  })

  describe('get deleted elements', () => {
    it('should return nothing when current env is empty', async () => {
      const elementsSource = buildElementsSourceFromElements([])

      const { deletedElements } = await getDeletedElements({ ...DEFAULT_PARAMS, elementsSource })

      expect(deletedElements).toHaveLength(0)
    })

    describe('elements in current env', () => {
      const stdInstance = new InstanceElement(
        'std_instance',
        new ObjectType({ elemID: new ElemID(NETSUITE, 'role') }),
        { [SCRIPT_ID]: 'std_instance_script_id' },
      )
      const customRecordType1 = new ObjectType({
        elemID: new ElemID(NETSUITE, 'customrecord1'),
        annotations: { [METADATA_TYPE]: CUSTOM_RECORD_TYPE, [SCRIPT_ID]: 'customrecord1' },
      })
      const customRecordType2 = new ObjectType({
        elemID: new ElemID(NETSUITE, 'customrecord2'),
        annotations: { [METADATA_TYPE]: CUSTOM_RECORD_TYPE, [SCRIPT_ID]: 'customrecord2' },
      })
      const customRecord = new InstanceElement(
        'custom_record',
        customRecordType2,
        { [SCRIPT_ID]: 'custom_record_script_id' },
        [],
      )
      const dataElement = new InstanceElement(
        'data_element',
        new ObjectType({ elemID: new ElemID(NETSUITE, 'location') }),
      )
      const elements = [stdInstance, customRecordType1, customRecordType2, customRecord, dataElement]
      const elementsSource = buildElementsSourceFromElements(elements)

      it('should return nothing when current elements do not match fetch query scope', async () => {
        const thinFetchQuery = {
          isTypeMatch: (name: string) => name === 'a',
          isCustomRecordTypeMatch: (name: string) => name === 'b',
          isObjectMatch: () => true,
        } as unknown as NetsuiteQuery

        const { deletedElements } = await getDeletedElements({
          ...DEFAULT_PARAMS,
          elementsSource,
          fetchQuery: thinFetchQuery,
        })

        expect(deletedElements).toEqual(undefined)
      })

      it('should return all current elements when service return nothing (all deleted)', async () => {
        const { deletedElements } = await getDeletedElements({ ...DEFAULT_PARAMS, elementsSource })

        expect(deletedElements).toHaveLength(5)
        const resNames = deletedElements?.map(item => item.getFullName())
        expect(resNames).toContain(stdInstance.elemID.getFullName())
        expect(resNames).toContain(customRecordType1.elemID.getFullName())
        expect(resNames).toContain(customRecordType2.elemID.getFullName())
        expect(resNames).toContain(customRecord.elemID.getFullName())
        expect(resNames).toContain(dataElement.elemID.getFullName())
      })

      it('should not return current data elements that is not part of the requested data type', async () => {
        const { deletedElements } = await getDeletedElements({
          ...DEFAULT_PARAMS,
          elementsSource,
          requestedDataTypes: [],
        })

        expect(deletedElements).toHaveLength(4)
        const resNames = deletedElements?.map(item => item.getFullName())
        expect(resNames).toContain(stdInstance.elemID.getFullName())
        expect(resNames).toContain(customRecordType1.elemID.getFullName())
        expect(resNames).toContain(customRecordType2.elemID.getFullName())
        expect(resNames).toContain(customRecord.elemID.getFullName())
      })

      it('should not return current data element that still exists in service', async () => {
        const { deletedElements } = await getDeletedElements({
          ...DEFAULT_PARAMS,
          elementsSource,
          serviceDataElements: [dataElement],
        })

        expect(deletedElements).toHaveLength(4)
        const resNames = deletedElements?.map(item => item.getFullName())
        expect(resNames).toContain(stdInstance.elemID.getFullName())
        expect(resNames).toContain(customRecordType1.elemID.getFullName())
        expect(resNames).toContain(customRecordType2.elemID.getFullName())
        expect(resNames).toContain(customRecord.elemID.getFullName())
      })

      it('should not return current standard instance that still exists in service', async () => {
        const { deletedElements } = await getDeletedElements({
          ...DEFAULT_PARAMS,
          elementsSource,
          serviceInstanceIds: [{ type: stdInstance.elemID.typeName, instanceId: stdInstance.value[SCRIPT_ID] }],
        })

        expect(deletedElements).toHaveLength(4)
        const resNames = deletedElements?.map(item => item.getFullName())
        expect(resNames).toContain(customRecordType1.elemID.getFullName())
        expect(resNames).toContain(customRecordType2.elemID.getFullName())
        expect(resNames).toContain(customRecord.elemID.getFullName())
        expect(resNames).toContain(dataElement.elemID.getFullName())
      })

      it('should not return current custom record that were returned by the service in the fetch flow', async () => {
        const { deletedElements } = await getDeletedElements({
          ...DEFAULT_PARAMS,
          elementsSource,
          serviceCustomRecords: [customRecord],
          requestedCustomRecordTypes: [customRecordType2],
          serviceInstanceIds: [{ type: CUSTOM_RECORD_TYPE, instanceId: customRecordType2.elemID.typeName }],
        })

        expect(mockRunSuiteQL).toHaveBeenCalledTimes(2)
        expect(deletedElements).toHaveLength(3)
        const resNames = deletedElements?.map(item => item.getFullName())
        expect(resNames).toContain(stdInstance.elemID.getFullName())
        expect(resNames).toContain(customRecordType1.elemID.getFullName())
        expect(resNames).toContain(dataElement.elemID.getFullName())
      })

      it('should not query SuiteQL for a type that was already requested', async () => {
        const { deletedElements } = await getDeletedElements({
          ...DEFAULT_PARAMS,
          elementsSource,
          requestedCustomRecordTypes: [customRecordType1, customRecordType2],
          serviceInstanceIds: [
            { type: CUSTOM_RECORD_TYPE, instanceId: customRecordType1.elemID.typeName },
            { type: CUSTOM_RECORD_TYPE, instanceId: customRecordType2.elemID.typeName },
          ],
        })

        expect(mockRunSuiteQL).toHaveBeenCalledTimes(1)
        expect(deletedElements).toHaveLength(3)
        const resNames = deletedElements?.map(item => item.getFullName())
        expect(resNames).toContain(stdInstance.elemID.getFullName())
        expect(resNames).toContain(customRecord.elemID.getFullName())
        expect(resNames).toContain(dataElement.elemID.getFullName())
      })

      it('should not return current custom record that still exists in service', async () => {
        mockRunSuiteQL.mockReset()
        mockRunSuiteQL.mockResolvedValueOnce([{ scriptid: 'customrecord2' }])
        mockRunSuiteQL.mockResolvedValueOnce([{ scriptid: 'custom_record_script_id' }])
        const { deletedElements } = await getDeletedElements({
          ...DEFAULT_PARAMS,
          elementsSource,
          serviceInstanceIds: [{ type: CUSTOM_RECORD_TYPE, instanceId: customRecordType2.elemID.typeName }],
        })

        expect(mockRunSuiteQL).toHaveBeenCalledTimes(2)
        expect(deletedElements).toHaveLength(3)
        const resNames = deletedElements?.map(item => item.getFullName())
        expect(resNames).toContain(stdInstance.elemID.getFullName())
        expect(resNames).toContain(customRecordType1.elemID.getFullName())
        expect(resNames).toContain(dataElement.elemID.getFullName())
      })
    })
  })
})
