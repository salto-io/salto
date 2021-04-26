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
import setServiceUrl from '../../src/service_url/file_cabinet'
import { file, folder } from '../../src/types/file_cabinet_types'


describe('setFileCabinetUrls', () => {
  const getPathInternalIdMock = jest.fn()
  const client = {
    getPathInternalId: getPathInternalIdMock,
    url: 'https://accountid.app.netsuite.com',
  } as unknown as NetsuiteClient

  const elements = [
    new InstanceElement('A', file, { path: '/path/A' }),
    new InstanceElement('B', folder, { path: '/path/B' }),
    new InstanceElement('C', folder, { path: '/path/C' }),
  ]

  beforeEach(() => {
    jest.resetAllMocks()
    getPathInternalIdMock.mockResolvedValueOnce(1)
    getPathInternalIdMock.mockResolvedValueOnce(2)
  })

  it('should set the right url', async () => {
    await setServiceUrl(elements, client)
    expect(elements[0].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe('https://accountid.app.netsuite.com/app/common/media/mediaitem.nl?id=1')
    expect(elements[1].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe('https://accountid.app.netsuite.com/app/common/media/mediaitemfolder.nl?id=2')
  })

  it('should not set url if not found internal id', async () => {
    await setServiceUrl(elements, client)
    expect(elements[2].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBeUndefined()
  })
})
