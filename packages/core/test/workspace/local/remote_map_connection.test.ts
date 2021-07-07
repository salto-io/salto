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
import { createRemoteMapCreator } from '../../../src/local-workspace/remote_map'


describe('connection creation should be atomic', () => {
  const DB_LOCATION = '/tmp/test_db'
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

  const mockOpen = jest.fn().mockImplementation((_opts, cb) => {
    cb()
  })
  beforeEach(() => {
    jest.mock('../../../src/local-workspace/rocksdb', () => ({
      default: () => ({
        open: mockOpen,
      }),
    }))
  })
  afterEach(() => {
    jest.clearAllMocks()
  })
  it('should create a single persistent db connection for a location', async () => {
    await Promise.all([
      createMap('integration'),
      createMap('integration'),
    ])
    const mockCalls = mockOpen.mock.calls
    const readOnlyCalls = mockCalls.filter(args => args[0].readOnly === true)
    const writeCalls = mockCalls.filter(args => args[0].readOnly === false)
    expect(readOnlyCalls).toHaveLength(1) // Checking if the DB is there
    expect(writeCalls).toHaveLength(3) // Two tmp connections and 1 persistent connection
  })
})
