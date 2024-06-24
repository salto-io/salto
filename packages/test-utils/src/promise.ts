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
export type Resolvable<T> = {
  promise: Promise<T>
  resolve: () => void
}

export const makeResolvablePromise = <T>(resolveValue: T): Resolvable<T> => {
  // istanbul ignore next (the default function will always be overwritten in the Promise ctor)
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  let resolve: () => void = () => {}
  // Unsafe assumption - promise constructor calls the paramter function synchronously
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
