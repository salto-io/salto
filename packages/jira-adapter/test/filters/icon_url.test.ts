/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { getFilterParams } from '../utils'
import iconUrlFilter from '../../src/filters/icon_url'
import { Filter } from '../../src/filter'
import { JIRA, STATUS_TYPE_NAME } from '../../src/constants'

describe('iconUrlFilter', () => {
  let filter: Filter
  let type: ObjectType
  beforeEach(async () => {
    filter = iconUrlFilter(getFilterParams())

    type = new ObjectType({
      elemID: new ElemID(JIRA, STATUS_TYPE_NAME),
    })
  })

  describe('preDeploy', () => {
    it('should convert iconUrl to iconurl', async () => {
      const instance = new InstanceElement('instance', type, {
        iconUrl: 'someUrl',
      })

      await filter.preDeploy?.([toChange({ after: instance })])

      expect(instance.value).toEqual({
        iconurl: 'someUrl',
      })
    })
  })

  describe('onDeploy', () => {
    it('should convert iconurl to iconUrl', async () => {
      const instance = new InstanceElement('instance', type, {
        iconurl: 'someUrl',
      })

      await filter.onDeploy?.([toChange({ after: instance })])

      expect(instance.value).toEqual({
        iconUrl: 'someUrl',
      })
    })
  })
})
