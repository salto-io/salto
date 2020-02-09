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
import {
  RequestPromise,
} from 'requestretry'
import Connection, {
  Contact, Form, Workflow, MarketingEmail,
} from '../src/client/madku'

const mockMadKu: () => Connection = () => ({
  forms: {
    getAll: jest.fn().mockImplementation((): RequestPromise =>
      ([] as unknown as RequestPromise)),
    delete: jest.fn().mockImplementation((): RequestPromise =>
      (undefined as unknown as RequestPromise)),
    update: jest.fn().mockImplementation((): RequestPromise =>
      ({} as unknown as RequestPromise)),
    create: jest.fn().mockImplementation((): RequestPromise =>
      ({} as unknown as RequestPromise)),
  } as Form,
  workflows: {
    getAll: jest.fn().mockImplementation((): RequestPromise =>
      ({ workflows: [] } as unknown as RequestPromise)),
    enroll: jest.fn().mockImplementation((): RequestPromise =>
      (undefined as unknown as RequestPromise)),
    unenroll: jest.fn().mockImplementation((): RequestPromise =>
      ({} as unknown as RequestPromise)),
    create: jest.fn().mockImplementation((): RequestPromise =>
      ({} as unknown as RequestPromise)),
    delete: jest.fn().mockImplementation((): RequestPromise =>
      (undefined as unknown as RequestPromise)),
    get: jest.fn().mockImplementation((): RequestPromise =>
      (undefined as unknown as RequestPromise)),
  } as Workflow,
  marketingEmail: {
    getAll: jest.fn().mockImplementation((): RequestPromise =>
      ({ objects: [] } as unknown as RequestPromise)),
    create: jest.fn().mockImplementation((): RequestPromise =>
      ({} as unknown as RequestPromise)),
    update: jest.fn().mockImplementation((): RequestPromise =>
      ({} as unknown as RequestPromise)),
    delete: jest.fn().mockImplementation((): RequestPromise =>
      (undefined as unknown as RequestPromise)),
  } as MarketingEmail,
  contacts: {
    get: jest.fn().mockImplementation((): RequestPromise =>
      ([] as unknown as RequestPromise)),
    getAll: jest.fn().mockImplementation((): RequestPromise =>
      ([] as unknown as RequestPromise)),
    create: jest.fn().mockImplementation((): RequestPromise =>
      ({} as unknown as RequestPromise)),
  } as Contact,
})

export default mockMadKu
