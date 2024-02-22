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
import { makeResolvablePromise, Resolvable, stepManager, StepManager } from '../src'

describe('makeResolvablePromise', () => {
  let resolvable: Resolvable<number>
  let isResolved: boolean
  beforeEach(() => {
    isResolved = false
    resolvable = makeResolvablePromise(5)
    const p = resolvable.promise.then(() => {
      isResolved = true
    })
    expect(p).toBeInstanceOf(Promise)
  })
  it('should create an unresolved promise', async () => {
    // Break execution to ensure the callback will be called if the promise is resolved
    // this is not really necessary, but added as extra safety
    await new Promise(resolve => setImmediate(resolve))
    expect(isResolved).toBeFalsy()
  })
  it('should resolve the promise to the given value once resolve is called', async () => {
    resolvable.resolve()
    expect(await resolvable.promise).toEqual(5)
  })
})

describe('stepManager', () => {
  type StepName = 'a' | 'b' | 'c'
  const stepNames = ['a', 'b', 'c'] as const
  let manager: StepManager<StepName>
  let resolvedSteps: Record<StepName, boolean>
  beforeEach(() => {
    manager = stepManager(stepNames)
    resolvedSteps = Object.fromEntries(stepNames.map(name => [name, false])) as Record<StepName, boolean>

    stepNames.forEach(stepName => {
      const p = manager.waitStep(stepName).then(() => {
        resolvedSteps[stepName] = true
      })
      expect(p).toBeInstanceOf(Promise)
    })
  })
  it('should start with all steps unresolved', async () => {
    // Break execution to ensure the callback will be called if the promise is resolved
    // this is not really necessary, but added as extra safety
    await new Promise(resolve => setImmediate(resolve))
    expect(resolvedSteps).toEqual(Object.fromEntries(stepNames.map(name => [name, false])))
  })
  it('should resolve a step when the resolve function is called', async () => {
    manager.resolveStep('a')
    await manager.waitStep('a')
    expect(resolvedSteps.a).toBeTruthy()
    expect(resolvedSteps.b).toBeFalsy()
    expect(resolvedSteps.c).toBeFalsy()
  })
})
