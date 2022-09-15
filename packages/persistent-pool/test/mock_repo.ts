/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { mockFunction, MockInterface } from '@salto-io/test-utils'
import { Repo, Pool, LeaseWithStatus } from '../src/index'

export const createMockPool = <T>(): MockInterface<Pool<T>> => ({
  [Symbol.asyncIterator]: jest.fn<AsyncIterator<LeaseWithStatus<T>>, []>(),
  register: mockFunction<Pool<T>['register']>(),
  unregister: mockFunction<Pool<T>['unregister']>(),
  suspend: mockFunction<Pool<T>['suspend']>(),
  lease: mockFunction<Pool<T>['lease']>(),
  waitForLease: mockFunction<Pool<T>['waitForLease']>(),
  updateTimeout: mockFunction<Pool<T>['updateTimeout']>(),
  return: mockFunction<Pool<T>['return']>(),
  clear: mockFunction<Pool<T>['clear']>(),
})

export const createMockRepo = (): Repo => ({
  pool: <T>(): Promise<Pool<T>> => Promise.resolve(createMockPool<T>()),
})
