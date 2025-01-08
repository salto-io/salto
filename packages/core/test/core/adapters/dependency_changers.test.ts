/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ObjectType,
  ElemID,
  DependencyChanger,
  dependencyChange,
  DependencyChange,
  ChangeEntry,
  AdapterOperations,
  toChange,
} from '@salto-io/adapter-api'
import { mockFunction } from '@salto-io/test-utils'
import { getAdapterDependencyChangers } from '../../../src/core/adapters'

describe('getAdapterDependencyChangers', () => {
  const mockAdapter = (dependencyChanger?: DependencyChanger): AdapterOperations => ({
    fetch: mockFunction<AdapterOperations['fetch']>(),
    deploy: mockFunction<AdapterOperations['deploy']>(),
    deployModifiers: {
      dependencyChanger,
    },
  })

  const mockDepChanges = [dependencyChange('add', 1, 2)]
  const mockCreators: Record<string, AdapterOperations> = {
    withDepChanger: mockAdapter(mockFunction<DependencyChanger>().mockResolvedValue(mockDepChanges)),
    withoutDepChanger: mockAdapter(),
  }
  let depChangers: ReadonlyArray<DependencyChanger>
  beforeAll(async () => {
    depChangers = getAdapterDependencyChangers(mockCreators)
  })
  it('should return only dep changes for adapters that defined dep changers', () => {
    expect(depChangers).toHaveLength(1)
  })
  describe('wrapped dependency changer', () => {
    const adapterChanges: ChangeEntry[] = [
      [1, toChange({ after: new ObjectType({ elemID: new ElemID('withDepChanger', 'type') }) })],
      [2, toChange({ after: new ObjectType({ elemID: new ElemID('withDepChanger', 'type2') }) })],
    ]
    const nonAdapterChanges: ChangeEntry[] = [
      [3, toChange({ after: new ObjectType({ elemID: new ElemID('withoutDepChanger', 'type') }) })],
    ]
    const allDeps = new Map([
      [1, new Set([2, 3])],
      [3, new Set([2])],
    ])
    const mockChanges = new Map(adapterChanges.concat(nonAdapterChanges))
    let resultChanges: DependencyChange[]
    beforeAll(async () => {
      resultChanges = [...(await depChangers[0](mockChanges, allDeps))]
    })
    it('should be called only with the changes of the same adapter and dependencies of changes within the adapter', async () => {
      expect(mockCreators.withDepChanger.deployModifiers?.dependencyChanger).toHaveBeenCalledWith(
        new Map(adapterChanges),
        new Map([[1, new Set([2])]]),
      )
    })
    it('should return the dependency changes the adapter returns', () => {
      expect(resultChanges).toEqual(mockDepChanges)
    })
  })
})
