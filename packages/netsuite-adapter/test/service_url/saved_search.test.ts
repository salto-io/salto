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
import setServiceUrl from '../../src/service_url/savedsearch'
import { savedsearch } from '../../src/types/custom_types/savedsearch'


describe('setSavedSearchUrls', () => {
  const runSavedSearchQueryMock = jest.fn()
  const client = {
    runSavedSearchQuery: runSavedSearchQueryMock,
    url: 'https://tstdrv2259448.app.netsuite.com',
  } as unknown as NetsuiteClient

  let elements: InstanceElement[]

  beforeEach(() => {
    jest.resetAllMocks()
    runSavedSearchQueryMock.mockResolvedValue([
      { id: 'someScriptId', internalid: [{ value: '1' }] },
    ])
    elements = [
      new InstanceElement('A', savedsearch, { scriptid: 'someScriptId' }),
    ]
  })

  it('should set the right url', async () => {
    await setServiceUrl(elements, client)
    expect(elements[0].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe('https://tstdrv2259448.app.netsuite.com/app/common/search/search.nl?cu=T&id=1')
  })

  it('should not set url if not found internal id', async () => {
    const notFoundElement = new InstanceElement('A2', savedsearch, { scriptid: 'someScriptID2' })
    await setServiceUrl([notFoundElement], client)
    expect(notFoundElement.annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBeUndefined()
  })

  it('invalid results should throw an error', async () => {
    runSavedSearchQueryMock.mockResolvedValue([{ id: 'someScriptID' }])
    await expect(setServiceUrl(elements, client)).rejects.toThrow()
  })

  it('query failure should throw an error', async () => {
    runSavedSearchQueryMock.mockResolvedValue(undefined)
    await expect(setServiceUrl(elements, client)).rejects.toThrow()
  })
})
