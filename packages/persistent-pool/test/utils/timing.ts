/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { types } from '@salto-io/lowerdash'

type Func<TArgs extends unknown[], TReturn> = (...args: TArgs) => TReturn

export type InvocationsMeasurements = number[]

export type Timings = {
  // eslint-disable-next-line @typescript-eslint/ban-types
  setup: <T extends {}, M extends types.KeysOfType<T, Function>>(objectName: string, object: T, method: M) => void
  invocations: Record<string, InvocationsMeasurements>
  teardown: () => void
}

function isPromiseLike<T>(x: unknown): x is PromiseLike<T> {
  return typeof (x as PromiseLike<T>).then === 'function'
}

const timings = (): Timings => {
  const invocations: Record<string, InvocationsMeasurements> = {}
  const teardowns: (() => void)[] = []

  const wrap =
    <TArgs extends unknown[], TReturn extends unknown | Promise<unknown>>(
      label: string,
      f: Func<TArgs, TReturn>,
    ): Func<TArgs, TReturn> =>
    (...args: TArgs): TReturn => {
      const before = Date.now()
      const result = f(...args)
      const after = (): TReturn => {
        ;(invocations[label] = invocations[label] ?? []).push(Date.now() - before)
        return result
      }
      return isPromiseLike(result)
        ? (result.then(after, e => {
            after()
            throw e
          }) as TReturn)
        : after()
    }

  // eslint-disable-next-line @typescript-eslint/ban-types
  const setup = <T extends {}, M extends types.KeysOfType<T, Function>>(
    objectName: string,
    object: T,
    method: M,
  ): void => {
    const original = object[method] as Func<unknown[], unknown>
    const label = `${objectName}.${String(method)}`
    object[method] = wrap(label, original) as T[M]
    teardowns.push(() => {
      object[method] = original as T[M]
    })
  }

  const teardown = (): void => {
    teardowns.forEach(f => f())
  }

  return {
    invocations,
    setup,
    teardown,
  }
}

export default timings
