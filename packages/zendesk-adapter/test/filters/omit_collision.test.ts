/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ObjectType, ElemID, InstanceElement, CORE_ANNOTATIONS, ReferenceExpression } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { createFilterCreatorParams } from '../utils'
import { ZENDESK } from '../../src/constants'
import filterCreator from '../../src/filters/omit_collision'
import { FilterResult } from '../../src/filter'

describe('collision errors', () => {
  type FilterType = filterUtils.FilterWith<'onFetch' | 'deploy', FilterResult>
  let filter: FilterType
  const objType = new ObjectType({ elemID: new ElemID(ZENDESK, 'obj') })
  const inst = new InstanceElement('inst1', objType, { name: 'test', position: 1 })
  const collidedInst = new InstanceElement('inst1', objType, { name: 'test', position: 2 }, undefined, {
    [CORE_ANNOTATIONS.SERVICE_URL]: 'someUrl',
  })
  const differentInst = new InstanceElement('inst2', objType, { name: 'test2', position: 3 }, undefined, {
    [CORE_ANNOTATIONS.SERVICE_URL]: 'someUrl',
  })
  const childInst1 = new InstanceElement('childInst1', objType, { name: 'childInst1', position: 2 }, undefined, {
    [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(inst.elemID, inst),
  })

  beforeEach(async () => {
    jest.clearAllMocks()
    filter = filterCreator(createFilterCreatorParams({})) as FilterType
  })

  describe('onFetch', () => {
    it('should return the correct message if there is a collision', async () => {
      const elements = [inst, collidedInst, differentInst]
      const filterResult = (await filter.onFetch(elements)) as FilterResult
      expect(filterResult.errors).toHaveLength(1)
      expect(filterResult.errors?.[0]).toEqual({
        severity: 'Warning',
        message: 'Some elements were not fetched due to Salto ID collisions',
        detailedMessage: `2 Zendesk elements and their child elements were not fetched, as they were mapped to a single ID zendesk.obj.instance.inst1:
inst1,
inst1 - open in Zendesk: someUrl .

Usually, this happens because of duplicate configuration names in the service. Make sure these element names are unique, and try fetching again.
Learn about additional ways to resolve this issue at https://help.salto.io/en/articles/6927157-salto-id-collisions .`,
      })
    })
    it('should return no errors if there were no collisions', async () => {
      const elements = [inst, differentInst]
      const filterResult = (await filter.onFetch(elements)) as FilterResult
      expect(filterResult.errors).toHaveLength(0)
    })
    it('should remove child element on collision', async () => {
      const elements = [inst, collidedInst, differentInst, childInst1]
      const filterResult = (await filter.onFetch(elements)) as FilterResult
      expect(filterResult.errors).toHaveLength(1)
      expect(elements).toEqual([differentInst])
    })
    it('should not remove child element if the parent has no collision', async () => {
      const elements = [inst, differentInst, childInst1]
      const filterResult = (await filter.onFetch(elements)) as FilterResult
      expect(filterResult.errors).toHaveLength(0)
      expect(elements).toEqual([inst, differentInst, childInst1])
    })
    it('should omit colliding elements if there is a collision', async () => {
      const elements = [inst, collidedInst, differentInst]
      const filterResult = (await filter.onFetch(elements)) as FilterResult
      expect(filterResult.errors).toHaveLength(1)
      expect(elements).toEqual([differentInst])
    })
    it('should not remove elements if there were no collisions', async () => {
      const elements = [inst, differentInst]
      const filterResult = (await filter.onFetch(elements)) as FilterResult
      expect(filterResult.errors).toHaveLength(0)
      expect(elements).toEqual([inst, differentInst])
    })
  })
})
