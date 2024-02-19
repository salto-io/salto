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
import { CORE_ANNOTATIONS, InstanceElement } from '@salto-io/adapter-api'
import NetsuiteClient from '../../src/client/client'
import setServiceUrl from '../../src/service_url/savedsearch'
import { savedsearchType } from '../../src/autogen/types/standard_types/savedsearch'
import { INTERNAL_ID } from '../../src/constants'

describe('setSavedSearchUrls', () => {
  const runSavedSearchQueryMock = jest.fn()
  const client = {
    runSavedSearchQuery: runSavedSearchQueryMock,
    url: 'https://accountid.app.netsuite.com',
  } as unknown as NetsuiteClient
  const savedsearch = savedsearchType().type

  it('should set the right url', async () => {
    const elements = [new InstanceElement('A', savedsearch, { scriptid: 'someScriptId', [INTERNAL_ID]: '1' })]
    await setServiceUrl(elements, client)
    expect(elements[0].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe(
      'https://accountid.app.netsuite.com/app/common/search/search.nl?cu=T&id=1',
    )
  })

  it('should not set url if not found internal id', async () => {
    const notFoundElement = new InstanceElement('A2', savedsearch, { scriptid: 'someScriptID2' })
    await setServiceUrl([notFoundElement], client)
    expect(notFoundElement.annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBeUndefined()
  })
})
