/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ObjectType, ElemID, toChange, DetailedChange } from '@salto-io/adapter-api'
import { reverseChange } from '../src/change'

describe('reverseChange', () => {
  let type: ObjectType

  beforeEach(() => {
    type = new ObjectType({ elemID: new ElemID('test', 'type') })
  })

  it('should reverse addition change', () => {
    const change = toChange({ after: type })
    expect(reverseChange(change)).toEqual(toChange({ before: type }))
  })

  it('should reverse removal change', () => {
    const change = toChange({ before: type })
    expect(reverseChange(change)).toEqual(toChange({ after: type }))
  })

  it('should reverse modification change', () => {
    const type2 = type.clone()
    type2.annotations.test = 'test'
    const change = toChange({ before: type, after: type2 })
    expect(reverseChange(change)).toEqual(toChange({ before: type2, after: type }))
  })

  describe('reverse detailed change elemIDs', () => {
    it('should reverse addition change', () => {
      const changeElemId = type.elemID.createNestedID('attr', 'list', '0')
      const change: DetailedChange = {
        id: changeElemId,
        elemIDs: { after: changeElemId },
        action: 'add',
        data: { after: 'a' },
      }
      expect(reverseChange(change)).toEqual({
        id: changeElemId,
        elemIDs: { before: changeElemId },
        action: 'remove',
        data: { before: 'a' },
      })
    })

    it('should reverse removal change', () => {
      const changeElemId = type.elemID.createNestedID('attr', 'list', '0')
      const change: DetailedChange = {
        id: changeElemId,
        elemIDs: { before: changeElemId },
        action: 'remove',
        data: { before: 'a' },
      }
      expect(reverseChange(change)).toEqual({
        id: changeElemId,
        elemIDs: { after: changeElemId },
        action: 'add',
        data: { after: 'a' },
      })
    })

    it('should reverse modification change', () => {
      const changeElemId = type.elemID.createNestedID('attr', 'list', '0')
      const changeBeforeElemId = type.elemID.createNestedID('attr', 'list', '1')
      const change: DetailedChange = {
        id: changeElemId,
        elemIDs: { before: changeBeforeElemId, after: changeElemId },
        action: 'modify',
        data: { before: 'a', after: 'a' },
      }
      expect(reverseChange(change)).toEqual({
        id: changeElemId,
        elemIDs: { before: changeElemId, after: changeBeforeElemId },
        action: 'modify',
        data: { before: 'a', after: 'a' },
      })
    })
  })

  describe('reverse detailed change baseChange', () => {
    it('should reverse addition change', () => {
      const baseChange = toChange({ after: type })
      const change: DetailedChange = {
        id: type.elemID,
        baseChange,
        ...baseChange,
      }
      const reversedBaseChange = toChange({ before: type })
      expect(reverseChange(change)).toEqual({
        id: type.elemID,
        baseChange: reversedBaseChange,
        ...reversedBaseChange,
      })
    })

    it('should reverse removal change', () => {
      const baseChange = toChange({ before: type })
      const change: DetailedChange = {
        id: type.elemID,
        baseChange,
        ...baseChange,
      }
      const reversedBaseChange = toChange({ after: type })
      expect(reverseChange(change)).toEqual({
        id: type.elemID,
        baseChange: reversedBaseChange,
        ...reversedBaseChange,
      })
    })

    it('should reverse modification change', () => {
      const type2 = type.clone()
      type2.annotations.test = 'test'
      const baseChange = toChange({ before: type, after: type2 })
      const change: DetailedChange = {
        id: type.elemID.createNestedID('attr', 'test'),
        action: 'add',
        data: { after: 'test' },
        baseChange,
      }
      const reversedBaseChange = toChange({ after: type, before: type2 })
      expect(reverseChange(change)).toEqual({
        id: type.elemID.createNestedID('attr', 'test'),
        action: 'remove',
        data: { before: 'test' },
        baseChange: reversedBaseChange,
      })
    })
  })
})
