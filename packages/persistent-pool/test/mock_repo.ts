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
import { types } from '@salto-io/lowerdash'
import { Repo, Pool, LeaseWithStatus } from '../src/index'

const mockFunc = <
  T,
  // eslint-disable-next-line @typescript-eslint/ban-types
  FN extends types.KeysOfType<T, Function>,
  F extends T[FN] = T[FN],
  RT extends ReturnType<F> = ReturnType<F>,
  PT extends Parameters<F> = Parameters<F>,
>(): jest.Mock<RT, PT> => jest.fn<RT, PT>()

export type MockObj<T> = T & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [K in keyof T]: T[K] extends (...args: any) => any ? jest.Mock<ReturnType<T[K]>> : never
}

const mockPoolFunc = <
  T,
  // eslint-disable-next-line @typescript-eslint/ban-types
  FN extends types.KeysOfType<Pool<T>, Function>,
  F extends Pool<T>[FN] = Pool<T>[FN],
>(): jest.Mock<ReturnType<F>, Parameters<F>> => mockFunc<Pool<T>, FN>()

export const createMockPool = <T>(): MockObj<Pool<T>> => ({
  [Symbol.asyncIterator]: jest.fn<AsyncIterator<LeaseWithStatus<T>>, []>(),
  register: mockPoolFunc<T, 'register'>(),
  unregister: mockPoolFunc<T, 'unregister'>(),
  suspend: mockPoolFunc<T, 'suspend'>(),
  lease: mockPoolFunc<T, 'lease'>(),
  waitForLease: mockPoolFunc<T, 'waitForLease'>(),
  updateTimeout: mockPoolFunc<T, 'updateTimeout'>(),
  return: mockPoolFunc<T, 'return'>(),
  clear: mockPoolFunc<T, 'clear'>(),
})

export const createMockRepo = (): Repo => ({
  pool: <T>(): Promise<Pool<T>> => Promise.resolve(createMockPool<T>()),
})
