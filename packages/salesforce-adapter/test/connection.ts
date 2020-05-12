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
import Connection, { Metadata, Soap } from '../src/client/jsforce'
import { createEncodedZipContent } from './utils'

const mockJsforce: () => Connection = () => ({
  login: jest.fn().mockImplementation(
    (_user: string, _password: string) =>
      Promise.resolve({ id: '', organizationId: '', url: '' })
  ),
  metadata: {
    describe: jest.fn().mockImplementation(() => Promise.resolve({ metadataObjects: [] })),
    describeValueType: jest.fn().mockImplementation(() => Promise.resolve([])),
    read: jest.fn().mockImplementation(() => Promise.resolve([])),
    list: jest.fn().mockImplementation(() => Promise.resolve([])),
    upsert: jest.fn().mockImplementation(() => Promise.resolve([])),
    delete: jest.fn().mockImplementation(() => Promise.resolve([])),
    update: jest.fn().mockImplementation(() => Promise.resolve([])),
    retrieve: jest.fn().mockImplementation(() =>
      ({ complete: async () => ({ zipFile: createEncodedZipContent([]) }) })),
    deploy: jest.fn().mockImplementation(() => Promise.resolve({})),
  } as Metadata,
  soap: {
    describeSObjects: jest.fn().mockImplementation(() => Promise.resolve([])),
  } as Soap,

  describeGlobal: jest.fn().mockImplementation(async () => Promise.resolve({ sobjects: [] })),
  limits: jest.fn().mockImplementation(() => Promise.resolve({
    DailyApiRequests: { Remaining: 10000 },
  })),
})

export default mockJsforce
