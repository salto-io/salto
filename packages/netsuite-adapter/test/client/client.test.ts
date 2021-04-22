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
import SuiteAppClient from '../../src/client/suiteapp_client/suiteapp_client'
import SdfClient from '../../src/client/sdf_client'
import * as suiteAppFileCabinet from '../../src/suiteapp_file_cabinet'
import NetsuiteClient from '../../src/client/client'

describe('NetsuiteClient', () => {
  const sdfClient = {
    getCredentials: () => ({ accountId: 'someId' }),
  } as unknown as SdfClient

  const suiteAppClient = {} as SuiteAppClient

  const getPathToIdMapMock = jest.fn()
  jest.spyOn(suiteAppFileCabinet, 'createSuiteAppFileCabinetOperations').mockReturnValue({
    getPathToIdMap: getPathToIdMapMock,
  } as unknown as suiteAppFileCabinet.SuiteAppFileCabinetOperations)

  const client = new NetsuiteClient(sdfClient, suiteAppClient)

  beforeEach(() => {
    jest.resetAllMocks()
  })

  describe('getPathInternalId', () => {
    it('should return the right id', async () => {
      getPathToIdMapMock.mockResolvedValue({ '/some/path': 1 })
      expect(await client.getPathInternalId('/some/path')).toBe(1)
      expect(await client.getPathInternalId('/some/path2')).toBeUndefined()
    })

    it('should return undefined when failed to get map', async () => {
      getPathToIdMapMock.mockResolvedValue(undefined)
      expect(await client.getPathInternalId('/some/path1')).toBeUndefined()
    })
  })
})
