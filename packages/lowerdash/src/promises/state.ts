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
export type PromiseWithState<T> = Promise<T> & {
  done: boolean
  resolved: boolean
  rejected: boolean
}

const isPromiseWithState = <T>(o: Promise<T>): o is PromiseWithState<T> =>
  ['done', 'resolved', 'rejected'].every(p => Object.prototype.hasOwnProperty.call(o, p))

const defineGetter = <T, TReturn>(o: T, name: string, ret: () => TReturn): void => {
  Object.defineProperty(o, name, { get: ret })
}

export const promiseWithState = <T>(promise: Promise<T>): PromiseWithState<T> => {
  if (isPromiseWithState(promise)) {
    return promise
  }

  let done = false
  let resolved = false
  let rejected = false

  const result = promise.then(
    (v: T) => {
      done = true
      resolved = true
      return v
    },
    // any is the actual type of the argument
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (reason: any) => {
      done = true
      rejected = true
      throw reason
    },
  )

  defineGetter(result, 'done', () => done)
  defineGetter(result, 'resolved', () => resolved)
  defineGetter(result, 'rejected', () => rejected)

  return result as PromiseWithState<T>
}
