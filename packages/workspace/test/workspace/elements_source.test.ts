/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { BuiltinTypes, ElemID, ObjectType, Element, ReadOnlyElementsSource } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import {
  createInMemoryElementSource,
  createOverrideReadOnlyElementsSource,
  RemoteElementSource,
} from '../../src/workspace/elements_source'

const { awu } = collections.asynciterable

describe('RemoteElementSource', () => {
  let elemSource: RemoteElementSource
  beforeEach(() => {
    elemSource = createInMemoryElementSource([BuiltinTypes.NUMBER, BuiltinTypes.BOOLEAN])
  })
  describe('has', () => {
    it('should return true when element exists', async () => {
      expect(await elemSource.has(BuiltinTypes.NUMBER.elemID)).toEqual(true)
    })
    it('should return false when element does not exist', async () => {
      expect(await elemSource.has(new ElemID('dummy', 'not-exist'))).toEqual(false)
    })
  })
  describe('rename', () => {
    it('should throw', () => {
      expect(() => elemSource.rename('test')).toThrow()
    })
  })
  describe('isEmpty', () => {
    it('should return false when there are elements', async () => {
      expect(await elemSource.isEmpty()).toEqual(false)
    })
    it('should return true when there are no elements', async () => {
      expect(await createInMemoryElementSource([]).isEmpty()).toEqual(true)
    })
  })
})

describe('overrideReadOnlyElementsSource', () => {
  let originalElem: ObjectType
  let overriddenElem: ObjectType
  let changedOverriddenElem: ObjectType
  let removedElem: ObjectType
  let newElem: ObjectType
  let source: RemoteElementSource
  let overrideSource: ReadOnlyElementsSource
  beforeEach(() => {
    originalElem = new ObjectType({ elemID: new ElemID('test', 'type') })
    overriddenElem = new ObjectType({ elemID: new ElemID('test', 'override'), annotations: { value: 'orig' } })
    removedElem = new ObjectType({ elemID: new ElemID('test', 'removed') })
    source = createInMemoryElementSource([originalElem, overriddenElem])
    changedOverriddenElem = overriddenElem.clone()
    changedOverriddenElem.annotations.value = 'changed'
    newElem = new ObjectType({ elemID: new ElemID('test', 'new') })
    overrideSource = createOverrideReadOnlyElementsSource(source, {
      [overriddenElem.elemID.getFullName()]: changedOverriddenElem,
      [removedElem.elemID.getFullName()]: undefined,
      [newElem.elemID.getFullName()]: newElem,
    })
  })
  describe('list', () => {
    let listResult: string[]
    beforeEach(async () => {
      listResult = await awu(await overrideSource.list())
        .map(id => id.getFullName())
        .toArray()
    })
    it('should return an ordered list of IDs', () => {
      const sortedList = listResult.map(id => id).sort()
      expect(listResult).toEqual(sortedList)
    })
    it('should omit ids that were removed by overrides', () => {
      expect(listResult).not.toContainEqual(removedElem.elemID.getFullName())
    })
    it('should return ids from original source without override removals', () => {
      expect(listResult).toContainValues([newElem, overriddenElem, originalElem].map(elem => elem.elemID.getFullName()))
    })
  })
  describe('has', () => {
    it('should return true for ids from the origin that were no removed', async () => {
      await expect(overrideSource.has(overriddenElem.elemID)).resolves.toBeTrue()
      await expect(overrideSource.has(originalElem.elemID)).resolves.toBeTrue()
    })
    it('should return true for ids that were added by overrides', async () => {
      await expect(overrideSource.has(newElem.elemID)).resolves.toBeTrue()
    })
    it('should return false for ids that were removed by overrides', async () => {
      await expect(overrideSource.has(removedElem.elemID)).resolves.toBeFalse()
    })
  })
  describe('get', () => {
    describe('with overridden element', () => {
      let result: ObjectType
      beforeEach(async () => {
        result = await overrideSource.get(overriddenElem.elemID)
      })
      it('should return the value from the override', () => {
        expect(result.annotations).toEqual(changedOverriddenElem.annotations)
      })
    })

    describe('with removed element', () => {
      let result: ObjectType
      beforeEach(async () => {
        result = await overrideSource.get(removedElem.elemID)
      })
      it('should return undefined', () => {
        expect(result).toBeUndefined()
      })
    })
    describe('with added element', () => {
      let result: ObjectType
      beforeEach(async () => {
        result = await overrideSource.get(newElem.elemID)
      })
      it('should return the value from the override', () => {
        expect(result.isEqual(newElem)).toBeTrue()
      })
    })
    describe('with unchanged element', () => {
      let result: ObjectType
      beforeEach(async () => {
        result = await overrideSource.get(originalElem.elemID)
      })
      it('should return the original element', () => {
        expect(result.isEqual(originalElem)).toBeTrue()
      })
    })
  })
  describe('getAll', () => {
    let result: Element[]
    beforeEach(async () => {
      result = await awu(await overrideSource.getAll()).toArray()
    })
    it('should return elements ordered by ID', () => {
      const sortedList = result.map(elem => elem.elemID.getFullName()).sort()
      expect(result.map(elem => elem.elemID.getFullName())).toEqual(sortedList)
    })
    it('should omit elements that were removed by overrides', () => {
      expect(result).not.toContainEqual(removedElem)
    })
    it('should return elements from original source without override removals', () => {
      expect(result).toContainValues([newElem, changedOverriddenElem, originalElem])
    })
  })
})
