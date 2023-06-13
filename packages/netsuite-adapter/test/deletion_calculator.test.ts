/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { NetsuiteQuery } from '../src/query'
import { getDeletedElements } from '../src/deletion_calculator'
import { CUSTOM_RECORD_TYPE, METADATA_TYPE, SCRIPT_ID } from '../src/constants'

describe('deletion calculator', () => {
  const mockRunSuiteQL = jest.fn()
  const client = {
    runSuiteQL: mockRunSuiteQL,
  } as unknown as NetsuiteClient

  const fetchQuery = {
    isTypeMatch: () => true,
    isCustomRecordTypeMatch: () => true,
    isObjectMatch: () => true,
  } as unknown as NetsuiteQuery

  const DEFAULT_PARAMS = {
    client,
    fetchQuery,
    serviceInstanceIds: [],
    requestedCustomTypes: [],
    serviceCustomRecords: [],
    requestedDataTypes: [],
    serviceDataElements: [],
  }

  beforeEach(() => {
    mockRunSuiteQL.mockReset()
    mockRunSuiteQL.mockReturnValue([])
  })

  describe('get deleted elements', () => {
    it('should return nothing when current env is empty', async () => {
      const elementsSource = buildElementsSourceFromElements([])

      const res = await getDeletedElements({ ...DEFAULT_PARAMS, elementsSource })

      expect(res).toHaveLength(0)
    })

    describe('elements in current env', () => {
      const stdInstance = new InstanceElement(
        'std_instance',
        new ObjectType({ elemID: new ElemID('adapter', 'role') }),
        { [SCRIPT_ID]: 'std_instance_script_id' }
      )
      const customType = new ObjectType({
        elemID: new ElemID('adapter', 'customrecord1'),
        annotations: { [METADATA_TYPE]: CUSTOM_RECORD_TYPE },
      })
      const customRecordType = new ObjectType({ elemID: new ElemID('adapter', 'customrecord2') })
      const customRecord = new InstanceElement(
        'custom_record',
        customRecordType,
        { [SCRIPT_ID]: 'custom_record_script_id' }
      )
      const dataElement = new InstanceElement(
        'data_element',
        new ObjectType({ elemID: new ElemID('adapter', 'location') }),
        { [SCRIPT_ID]: 'data_element_script_id' }
      )
      const elements = [stdInstance, customType, customRecord, dataElement]
      const elementsSource = buildElementsSourceFromElements(elements)

      it('should return nothing when current elements do not match fetch query scope', async () => {
        const thinFetchQuery = {
          isTypeMatch: (name: string) => name === 'a',
          isCustomRecordTypeMatch: (name: string) => name === 'b',
          isObjectMatch: () => true,
        } as unknown as NetsuiteQuery

        const res = await getDeletedElements({ ...DEFAULT_PARAMS, elementsSource, requestedDataTypes: ['location'], fetchQuery: thinFetchQuery })

        expect(res).toHaveLength(0)
      })

      it('should return all current elements when service return nothing (all deleted)', async () => {
        const res = await getDeletedElements({ ...DEFAULT_PARAMS, elementsSource, requestedDataTypes: ['location'] })

        expect(res).toHaveLength(4)
        const resNames = res.map(item => item.getFullName())
        expect(resNames).toContain(stdInstance.elemID.getFullName())
        expect(resNames).toContain(customType.elemID.getFullName())
        expect(resNames).toContain(customRecord.elemID.getFullName())
        expect(resNames).toContain(dataElement.elemID.getFullName())
      })

      it('should not return current data elements that is not part of the requested data type', async () => {
        const res = await getDeletedElements({ ...DEFAULT_PARAMS, elementsSource })

        expect(res).toHaveLength(3)
        const resNames = res.map(item => item.getFullName())
        expect(resNames).toContain(stdInstance.elemID.getFullName())
        expect(resNames).toContain(customType.elemID.getFullName())
        expect(resNames).toContain(customRecord.elemID.getFullName())
      })

      it('should not return current data element that still exists in service', async () => {
        const res = await getDeletedElements({ ...DEFAULT_PARAMS, elementsSource, requestedDataTypes: ['location'], serviceDataElements: [dataElement] })

        expect(res).toHaveLength(3)
        const resNames = res.map(item => item.getFullName())
        expect(resNames).toContain(stdInstance.elemID.getFullName())
        expect(resNames).toContain(customType.elemID.getFullName())
        expect(resNames).toContain(customRecord.elemID.getFullName())
      })

      it('should not return current standard instance that still exists in service', async () => {
        const res = await getDeletedElements({
          ...DEFAULT_PARAMS,
          elementsSource,
          requestedDataTypes: ['location'],
          serviceInstanceIds: [{ type: stdInstance.elemID.typeName, instanceId: stdInstance.value[SCRIPT_ID] }],
        })

        expect(res).toHaveLength(3)
        const resNames = res.map(item => item.getFullName())
        expect(resNames).toContain(customType.elemID.getFullName())
        expect(resNames).toContain(customRecord.elemID.getFullName())
        expect(resNames).toContain(dataElement.elemID.getFullName())
      })

      it('should not return current custom record that were returned by the service in the fetch flow', async () => {
        const res = await getDeletedElements({ ...DEFAULT_PARAMS, elementsSource, requestedDataTypes: ['location'], serviceCustomRecords: [customRecord], requestedCustomTypes: [customRecordType] })

        expect(res).toHaveLength(3)
        const resNames = res.map(item => item.getFullName())
        expect(resNames).toContain(stdInstance.elemID.getFullName())
        expect(resNames).toContain(customType.elemID.getFullName())
        expect(resNames).toContain(dataElement.elemID.getFullName())
      })

      it('should not return current custom record that still exists in service', async () => {
        mockRunSuiteQL.mockReset()
        mockRunSuiteQL.mockResolvedValueOnce([
          { scriptid: 'customrecord1' },
          { scriptid: 'customrecord2' },
        ])
        mockRunSuiteQL.mockResolvedValueOnce([])
        mockRunSuiteQL.mockResolvedValueOnce([
          { scriptid: 'custom_record_script_id' },
        ])
        const res = await getDeletedElements({ ...DEFAULT_PARAMS, elementsSource, requestedDataTypes: ['location'] })

        expect(res).toHaveLength(3)
        const resNames = res.map(item => item.getFullName())
        expect(resNames).toContain(stdInstance.elemID.getFullName())
        expect(resNames).toContain(customType.elemID.getFullName())
        expect(resNames).toContain(dataElement.elemID.getFullName())
      })
    })
  })
})
