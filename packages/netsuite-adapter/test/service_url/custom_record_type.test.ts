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
import { CORE_ANNOTATIONS, InstanceElement } from '@salto-io/adapter-api'
import NetsuiteClient from '../../src/client/client'
import setServiceUrl from '../../src/service_url/custom_record_type'
import { customsegment } from '../../src/types/custom_types/customsegment'
import { customrecordtype } from '../../src/types/custom_types/customrecordtype'


describe('setCustomRecordTypesUrls', () => {
  const runSuiteQlMock = jest.fn()
  const client = {
    runSuiteQL: runSuiteQlMock,
    url: 'https://accountid.app.netsuite.com',
  } as unknown as NetsuiteClient

  let elements: InstanceElement[]

  beforeEach(() => {
    jest.resetAllMocks()
    runSuiteQlMock.mockResolvedValue([
      { scriptid: 'CUSTOMRECORD1', id: '1' },
      { scriptid: 'CUSTOMRECORD_CSEG1', id: '2' },
    ])
    elements = [
      new InstanceElement('A', customrecordtype, { scriptid: 'customrecord1' }),
      new InstanceElement('B', customsegment, { scriptid: 'cseg1' }),
    ]
  })

  it('should set the right url', async () => {
    await setServiceUrl(elements, client)
    expect(elements[0].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe('https://accountid.app.netsuite.com/app/common/custom/custrecord.nl?id=1')
    expect(elements[1].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe('https://accountid.app.netsuite.com/app/common/custom/custrecord.nl?id=2')
  })

  it('should not set url if not found internal id', async () => {
    const notFoundElement = new InstanceElement('A2', customrecordtype, { scriptid: 'someScriptID2' })
    await setServiceUrl([notFoundElement], client)
    expect(notFoundElement.annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBeUndefined()
  })

  it('invalid results should throw an error', async () => {
    runSuiteQlMock.mockResolvedValue([{ scriptid: 'someScriptID' }])
    await expect(setServiceUrl(elements, client)).rejects.toThrow()
  })
})
