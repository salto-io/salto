/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { ElemID, InstanceElement, ObjectType, ServiceIds } from '@salto-io/adapter-api'
import * as cli from '@salto-io/suitecloud-cli'
import { adapter, DEFAULT_SDF_CONCURRENCY } from '../src/adapter_creator'
import NetsuiteClient from '../src/client/client'
import NetsuiteAdapter from '../src/adapter'
import {
  TYPES_TO_SKIP, FILE_PATHS_REGEX_SKIP_LIST, FETCH_ALL_TYPES_AT_ONCE, SDF_CONCURRENCY_LIMIT,
} from '../src/constants'

jest.mock('../src/client/client')
jest.mock('../src/adapter')
jest.mock('@salto-io/suitecloud-cli')

const mockDownload = cli.SDKDownloadService.download as jest.Mock
mockDownload.mockResolvedValue({ errors: [], success: true })

describe('NetsuiteAdapter creator', () => {
  const credentials = new InstanceElement(
    ElemID.CONFIG_NAME,
    adapter.credentialsType,
    {
      accountId: 'foo',
      tokenId: 'bar',
      tokenSecret: 'secret',
    },
  )

  const sdfConcurrencyLimit = 2
  const config = new InstanceElement(
    ElemID.CONFIG_NAME,
    adapter.configType as ObjectType,
    {
      [TYPES_TO_SKIP]: ['test1'],
      [FILE_PATHS_REGEX_SKIP_LIST]: ['^/Templates.*'],
      [FETCH_ALL_TYPES_AT_ONCE]: false,
      [SDF_CONCURRENCY_LIMIT]: sdfConcurrencyLimit,
      notExist: ['not exist'],
    }
  )

  describe('validateCredentials', () => {
    beforeEach(async () => {
      jest.clearAllMocks()
    })

    it('should call validateCredentials with the correct credentials', async () => {
      jest.mock('@salto-io/suitecloud-cli', () => undefined, { virtual: true })
      await adapter.validateCredentials(credentials)
      expect(NetsuiteClient.validateCredentials).toHaveBeenCalledWith(credentials.value)
    })
  })

  describe('client creation', () => {
    it('should create the client correctly', () => {
      adapter.operations({ credentials, config })
      expect(NetsuiteClient).toHaveBeenCalledWith({
        credentials: credentials.value,
        sdfConcurrencyLimit,
      })
    })

    it('should create the client with default SDF_CONCURRENCY_LIMIT', () => {
      const configWithoutConcurrencyLimit = config.clone()
      delete configWithoutConcurrencyLimit.value[SDF_CONCURRENCY_LIMIT]
      adapter.operations({ credentials, config: configWithoutConcurrencyLimit })
      expect(NetsuiteClient).toHaveBeenCalledWith({
        credentials: credentials.value,
        sdfConcurrencyLimit: DEFAULT_SDF_CONCURRENCY,
      })
    })
  })

  describe('adapter creation', () => {
    const mockGetElemIdFunc = (adapterName: string, _serviceIds: ServiceIds, name: string):
      ElemID => new ElemID(adapterName, name)

    it('should create the adapter correctly', () => {
      adapter.operations({ credentials, config, getElemIdFunc: mockGetElemIdFunc })
      expect(NetsuiteAdapter).toHaveBeenCalledWith({
        client: expect.any(Object),
        config: {
          [TYPES_TO_SKIP]: ['test1'],
          [FILE_PATHS_REGEX_SKIP_LIST]: ['^/Templates.*'],
          [FETCH_ALL_TYPES_AT_ONCE]: false,
          [SDF_CONCURRENCY_LIMIT]: sdfConcurrencyLimit,
        },
        getElemIdFunc: mockGetElemIdFunc,
      })
    })

    it('should create the adapter correctly when not having config', () => {
      adapter.operations({ credentials, getElemIdFunc: mockGetElemIdFunc })
      expect(NetsuiteAdapter).toHaveBeenCalledWith({
        client: expect.any(Object),
        config: {
          [TYPES_TO_SKIP]: [],
          [FILE_PATHS_REGEX_SKIP_LIST]: [],
        },
        getElemIdFunc: mockGetElemIdFunc,
      })
    })

    it('should throw an error when creating the adapter with an invalid regex for FILE_PATHS_REGEX_SKIP_LIST', () => {
      const invalidConfig = new InstanceElement(
        ElemID.CONFIG_NAME,
        adapter.configType as ObjectType,
        {
          [FILE_PATHS_REGEX_SKIP_LIST]: ['\\'],
        }
      )
      expect(
        () => adapter.operations({
          credentials,
          config: invalidConfig,
          getElemIdFunc: mockGetElemIdFunc,
        })
      ).toThrow()
    })
  })

  describe('install', () => {
    it('should have an install functions', () => {
      expect(adapter.install).toBeDefined()
    })
    it('when installation succeeds', async () => {
      if (adapter.install) {
        const res = await adapter.install()
        expect(res).toEqual({ success: true, errors: [] })
        expect(mockDownload).toHaveBeenCalled()
      }
    })
    it('when installation fails with an expection', async () => {
      mockDownload.mockImplementationOnce(() => {
        throw new Error('FAILED')
      })
      if (adapter.install) {
        const res = await adapter.install()
        expect(res.success).toBeFalsy()
        expect(res.errors).toEqual(['FAILED'])
      }
    })
    it('when installation fails with sdf errors in return value', async () => {
      mockDownload.mockImplementationOnce(() => ({ errors: ['FAILED'], success: false }))
      if (adapter.install) {
        const res = await adapter.install()
        expect(res.success).toBeFalsy()
        expect(res.errors).toEqual(['FAILED'])
      }
    })
  })
})
