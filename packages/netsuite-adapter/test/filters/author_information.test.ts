/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import filterCreator, { EMPLOYEE_NAME_QUERY } from '../../src/filters/author_information'
import { NETSUITE } from '../../src/constants'
import NetsuiteClient from '../../src/client/client'
import { FilterOpts } from '../../src/filter'
import SuiteAppClient from '../../src/client/suiteapp_client/suiteapp_client'
import mockSdfClient from '../client/sdf_client'

describe('netsuite author information', () => {
  let filterOpts: FilterOpts
  let elements: InstanceElement[]
  let accountInstance: InstanceElement
  let customTypeInstance: InstanceElement
  const runSuiteQLMock = jest.fn()
  const runSavedSearchQueryMock = jest.fn()
  const SDFClient = mockSdfClient()
  const suiteAppClient = {
    runSuiteQL: runSuiteQLMock,
    runSavedSearchQuery: runSavedSearchQueryMock,
  } as unknown as SuiteAppClient

  const client = new NetsuiteClient(SDFClient, suiteAppClient)

  beforeEach(() => {
    runSuiteQLMock.mockReset()
    runSuiteQLMock.mockResolvedValueOnce([
      { id: '1', entityid: 'user 1 name' },
      { id: '2', entityid: 'user 2 name' },
      { id: '3', entityid: 'user 3 name' },
    ])
    runSuiteQLMock.mockResolvedValueOnce([
      { recordid: '1', recordtypeid: '-112', name: '1' },
      { recordid: '1', recordtypeid: '-123', name: '2' },
      { recordid: '2', recordtypeid: '-112', name: '3' },
    ])
    accountInstance = new InstanceElement('account', new ObjectType({ elemID: new ElemID(NETSUITE, 'account') }))
    accountInstance.value.internalId = '1'
    customTypeInstance = new InstanceElement('customRecordType', new ObjectType({ elemID: new ElemID(NETSUITE, 'customRecordType') }))
    customTypeInstance.value.internalId = '1'
    elements = [accountInstance, customTypeInstance]
    filterOpts = {
      client,
      elementsSourceIndex: { getIndexes: () => Promise.resolve({
        serviceIdsIndex: {},
        internalIdsIndex: {},
        customFieldsIndex: {},
      }) },
      elementsSource: buildElementsSourceFromElements([]),
      isPartial: false,
    }
  })

  it('should query information from api', async () => {
    await filterCreator(filterOpts).onFetch?.(elements)
    const systemNotesQuery = "SELECT recordid, recordtypeid, name FROM systemnote WHERE recordtypeid = '-112' or recordtypeid = '-123' ORDER BY date DESC"
    expect(runSuiteQLMock).toHaveBeenNthCalledWith(1, EMPLOYEE_NAME_QUERY)
    expect(runSuiteQLMock).toHaveBeenNthCalledWith(2, systemNotesQuery)
    expect(runSuiteQLMock).toHaveBeenCalledTimes(2)
  })

  it('should not query at all if there is no elements', async () => {
    await filterCreator(filterOpts).onFetch?.([])
    expect(runSuiteQLMock).not.toHaveBeenCalled()
  })

  it('should add names to elements', async () => {
    await filterCreator(filterOpts).onFetch?.(elements)
    expect(accountInstance.annotations[CORE_ANNOTATIONS.CHANGED_BY] === 'user 1 name').toBeTruthy()
    expect(customTypeInstance.annotations[CORE_ANNOTATIONS.CHANGED_BY] === 'user 2 name').toBeTruthy()
  })

  it('elements will stay the same if there is no author information', async () => {
    runSuiteQLMock.mockReset()
    await filterCreator(filterOpts).onFetch?.(elements)
    expect(Object.values(accountInstance.annotations)).toHaveLength(0)
    expect(Object.values(customTypeInstance.annotations)).toHaveLength(0)
  })
})
