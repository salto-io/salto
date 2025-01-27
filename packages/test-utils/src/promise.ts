/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
export type Resolvable<T> = {
  promise: Promise<T>
  resolve: () => void
}

export const makeResolvablePromise = <T>(resolveValue: T): Resolvable<T> => {
  // istanbul ignore next (the default function will always be overwritten in the Promise ctor)
  let resolve: () => void = () => {}
  // Unsafe assumption - promise constructor calls the parameter function synchronously
  let promiseCtorRan = false
  const promise = new Promise<T>(resolveFunc => {
    resolve = () => resolveFunc(resolveValue)
    promiseCtorRan = true
  })
  // istanbul ignore if (no way to make this happen)
  if (!promiseCtorRan) {
    throw new Error('Cannot create resolvable promise. constructor did not run synchronously')
  }
  return { promise, resolve }
}

export type StepManager<StepName extends string> = {
  waitStep: (name: StepName) => Promise<void>
  resolveStep: (name: StepName) => void
}

export const stepManager = <StepName extends string>(stepNames: ReadonlyArray<StepName>): StepManager<StepName> => {
  const stepPromises: Record<string, Resolvable<undefined>> = Object.fromEntries(
    stepNames.map(name => [name, makeResolvablePromise(undefined)]),
  )
  return {
    waitStep: name => stepPromises[name].promise,
    resolveStep: name => {
      stepPromises[name].resolve()
    },
  }
}
