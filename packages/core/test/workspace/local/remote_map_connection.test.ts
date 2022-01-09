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
import { remoteMap as rm } from '@salto-io/workspace'
import { createRemoteMapCreator, createReadOnlyRemoteMapCreator } from '../../../src/local-workspace/remote_map'

describe('connection creation', () => {
  const DB_LOCATION = '/tmp/test_db'
  const mockOpen = jest.fn().mockImplementation((_opts, cb) => { cb() })
  const mockClose = jest.fn().mockImplementation(cb => { cb() })
  beforeEach(() => {
    jest.mock('../../../src/local-workspace/rocksdb', () => ({
      default: () => ({
        open: mockOpen,
        close: mockClose,
      }),
    }))
  })
  afterEach(() => {
    jest.clearAllMocks()
  })
  describe('createRemoteMapCreator', () => {
    const createMap = async (
      namespace: string,
      persistent = true
    ): Promise<rm.RemoteMap<string>> =>
      createRemoteMapCreator(DB_LOCATION)({
        namespace,
        batchInterval: 1000,
        serialize: str => str,
        deserialize: async str => Promise.resolve(str),
        persistent,
      })
    it('should create a single persistent db connection for a location', async () => {
      await Promise.all([
        createMap('integration'),
        createMap('integration'),
      ])
      const mockCalls = mockOpen.mock.calls
      const writeCalls = mockCalls.filter(args => args[0].readOnly === false)
      const readOnlyCalls = mockCalls.filter(args => args[0].readOnly === true)
      // 1 for the creation, 2 tmp connections and 1 (persistent) db connection
      expect(writeCalls).toHaveLength(4)
      expect(readOnlyCalls).toHaveLength(0)
    })
    it('should try to open with read only mode if remote map is not persistent', async () => {
      await Promise.all([
        createMap('integration', false),
        createMap('integration', false),
      ])
      const mockCalls = mockOpen.mock.calls
      const writeCalls = mockCalls.filter(args => args[0].readOnly === false)
      const readOnlyCalls = mockCalls.filter(args => args[0].readOnly === true)
      // 1 for the creation and 1 db connection
      expect(readOnlyCalls).toHaveLength(2)
      // 2 tmp connections
      expect(writeCalls).toHaveLength(2)
    })
  })
  describe('createReadOnlyRemoteMapCreator', () => {
    const createMap = async (location: string, namespace: string): Promise<rm.RemoteMap<string>> =>
      createReadOnlyRemoteMapCreator(location)({ namespace, deserialize: async str => str })
    it('should open db successfully if the db does exist', async () => {
      await Promise.all([
        createMap(DB_LOCATION, 'integration'),
        createMap(DB_LOCATION, 'integration'),
      ])
      const mockCalls = mockOpen.mock.calls
      const writeCalls = mockCalls.filter(args => args[0].readOnly === false)
      const readOnlyCalls = mockCalls.filter(args => args[0].readOnly === true)
      // 1 for each connections - no connection caching in ReadOnlyRemoteMap
      expect(readOnlyCalls).toHaveLength(2)
      expect(writeCalls).toHaveLength(0)
    })
    it('should throw exception if db does not exist', async () => {
      mockOpen.mockImplementationOnce((_opts, _cb) => { throw new Error('err') })
      await expect(createMap(DB_LOCATION, 'integration')).rejects.toThrow()
    })
  })
})
