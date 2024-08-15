/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
