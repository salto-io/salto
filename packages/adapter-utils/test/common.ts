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
import { ChangeGroup, getChangeElement, toChange, ChangeParams, ChangeDataType } from '@salto-io/adapter-api'

export type MockFunction<T extends (...args: never[]) => unknown> =
  jest.Mock<ReturnType<T>, Parameters<T>>

export type MockInterface<T extends {}> = {
  [k in keyof T]: T[k] extends (...args: never[]) => unknown
    ? MockFunction<T[k]>
    : MockInterface<T[k]>
}

export const mockFunction = <T extends (...args: never[]) => unknown>(): MockFunction<T> => (
  jest.fn()
)

export const toChangeGroup = (...params: ChangeParams<ChangeDataType>[]): ChangeGroup => {
  const changes = params.map(toChange)
  return {
    groupID: getChangeElement(changes[0]).elemID.getFullName(),
    changes,
  }
}

export type Resolvable<T> = {
  promise: Promise<T>
  resolve: () => void
}

export const makeResolvablePromise = <T>(resolveValue: T): Resolvable<T> => {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  let resolve: () => void = () => {}
  // Unsafe assumption - promise constructor calls the paramter function synchronously
  const promise = new Promise<T>(resolveFunc => {
    resolve = () => resolveFunc(resolveValue)
  })
  return { promise, resolve }
}
