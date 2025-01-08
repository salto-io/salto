/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ObjectType, ElemID, BuiltinTypes, Element, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { makeFilter } from '../../src/filters/remove_restriction_annotations'
import * as constants from '../../src/constants'
import { defaultFilterContext } from '../utils'
import { FilterWith } from './mocks'

describe('remove restriction annotations filter', () => {
  const mockObjId = new ElemID(constants.SALESFORCE, 'AnimationRule')
  const mockType = new ObjectType({
    elemID: mockObjId,
    fields: {
      unrelated: {
        refType: BuiltinTypes.STRING,
        annotations: {
          _restriction: { values: ['a'] },
        },
      },
      targetField: {
        refType: BuiltinTypes.STRING,
        annotations: {
          _restriction: { values: ['a'] },
        },
      },
    },
    annotations: {
      [constants.METADATA_TYPE]: 'AnimationRule',
    },
  })
  const mockUnrelatedType = new ObjectType({
    elemID: mockObjId,
    fields: {
      unrelated: {
        refType: BuiltinTypes.STRING,
        annotations: {
          _restriction: { values: ['a'] },
        },
      },
      targetField: {
        refType: BuiltinTypes.STRING,
        annotations: {
          _restriction: { values: ['a'] },
        },
      },
    },
    annotations: {
      [constants.METADATA_TYPE]: 'somethingElse',
    },
  })

  const filter = makeFilter({
    AnimationRule: ['sobjectType', 'targetField'],
  })({ config: defaultFilterContext }) as FilterWith<'onFetch'>

  let testElements: Element[]

  beforeEach(() => {
    testElements = [mockType.clone(), mockUnrelatedType.clone()]
  })

  describe('on fetch', () => {
    beforeEach(() => filter.onFetch(testElements))

    it('should not remove restriction for unrelated fields', () => {
      const testType = testElements[0] as ObjectType
      expect(testType.fields.unrelated).toBeDefined()
      expect(testType.fields.unrelated.annotations).toHaveProperty(CORE_ANNOTATIONS.RESTRICTION)
      const unrelatedType = testElements[1] as ObjectType
      expect(unrelatedType.fields.targetField).toBeDefined()
      expect(unrelatedType.fields.targetField.annotations).toHaveProperty(CORE_ANNOTATIONS.RESTRICTION)
    })

    it('should remove annotation for related fields', () => {
      const testType = testElements[0] as ObjectType
      expect(testType.fields.targetField).toBeDefined()
      expect(testType.fields.targetField.annotations).not.toHaveProperty(CORE_ANNOTATIONS.RESTRICTION)
    })
  })
})
