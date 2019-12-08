/* eslint-disable no-console */
type Func<TArgs extends unknown[], TReturn> = (...args: TArgs) => TReturn

type FunctionPropertyNames<T> = {
  [K in keyof T]: T[K] extends Function ? K : never
}[keyof T]

export type InvocationsMeasurements = number[]

export type Timings = {
  setup: <T extends {}, M extends FunctionPropertyNames<T>>(
    objectName: string,
    object: T,
    method: M,
  ) => void
  invocations: Record<string, InvocationsMeasurements>
  teardown: () => void
}

function isPromiseLike<T>(x: unknown): x is PromiseLike<T> {
  return typeof (x as PromiseLike<T>).then === 'function'
}

const timings = (): Timings => {
  const invocations: Record<string, InvocationsMeasurements> = {}
  const teardowns: (() => void)[] = []

  const wrap = <TArgs extends unknown[], TReturn extends unknown | Promise<unknown>>(
    label: string, f: Func<TArgs, TReturn>
  ): Func<TArgs, TReturn> => (...args: TArgs): TReturn => {
      const before = Date.now()
      const result = f(...args)
      const after = (): TReturn => {
        (invocations[label] = invocations[label] ?? [])
          .push(Date.now() - before)
        return result
      }
      return isPromiseLike(result)
        ? result.then(after, e => { after(); throw e }) as TReturn
        : after()
    }

  const setup = <T extends {}, M extends FunctionPropertyNames<T>>(
    objectName: string, object: T, method: M
  ): void => {
    const original = object[method]
    const label = `${objectName}.${method}`
    object[method] = wrap(label, original) as T[M]
    teardowns.push(() => { object[method] = original })
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
