/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { ObjectType, ElemID, isObjectType, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { FilterWith } from '../../src/filter_utils'
import { hideTypesFilterCreator } from '../../src/filters/hide_types'
import { createMockQuery } from '../../src/fetch/query'

describe('hide types filter', () => {
  type FilterType = FilterWith<'onFetch'>
  const objType1 = new ObjectType({ elemID: new ElemID('adapter', 't1') })
  const objType2 = new ObjectType({ elemID: new ElemID('adapter', 't2') })

  beforeEach(async () => {
    jest.clearAllMocks()
  })

  const createFilter = (hideTypes: boolean): FilterType =>
    hideTypesFilterCreator()({
      fetchQuery: createMockQuery(),
      config: {
        fetch: {
          hideTypes,
        },
      },
    }) as FilterType

  describe('onFetch', () => {
    it('should hide the types if hide types is enabled in the config', async () => {
      const filter = createFilter(true)
      const elements = [objType1.clone(), objType2.clone()]
      await filter.onFetch(elements)
      expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual(['adapter.t1', 'adapter.t2'])
      const t1 = elements.filter(isObjectType).find(e => e.elemID.typeName === 't1')
      expect(t1?.annotations[CORE_ANNOTATIONS.HIDDEN]).toEqual(true)
      const t2 = elements.filter(isObjectType).find(e => e.elemID.typeName === 't2')
      expect(t2?.annotations[CORE_ANNOTATIONS.HIDDEN]).toEqual(true)
    })
    it('should not hide the types if hide types is disabled in the config', async () => {
      const filter = createFilter(false)
      const elements = [objType1.clone(), objType2.clone()]
      await filter.onFetch(elements)
      expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual(['adapter.t1', 'adapter.t2'])
      const t1 = elements.filter(isObjectType).find(e => e.elemID.typeName === 't1')
      expect(t1?.annotations[CORE_ANNOTATIONS.HIDDEN]).not.toBeDefined()
      const t2 = elements.filter(isObjectType).find(e => e.elemID.typeName === 't2')
      expect(t2?.annotations[CORE_ANNOTATIONS.HIDDEN]).not.toBeDefined()
    })
  })
})
