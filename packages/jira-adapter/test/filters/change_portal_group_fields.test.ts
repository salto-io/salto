/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { filterUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { InstanceElement } from '@salto-io/adapter-api'
import { getDefaultConfig } from '../../src/config/config'
import changePortalGroupFieldsFilter from '../../src/filters/change_portal_group_fields'
import { createEmptyType, getFilterParams } from '../utils'
import { PORTAL_GROUP_TYPE } from '../../src/constants'

describe('changePortalGroupFields filter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType
  let portalInstance: InstanceElement
  describe('on Fetch', () => {
    beforeEach(() => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableJSM = true
      filter = changePortalGroupFieldsFilter(getFilterParams({ config })) as typeof filter
      portalInstance = new InstanceElement('portalGroup1', createEmptyType(PORTAL_GROUP_TYPE), {
        id: 11,
        name: 'portalGroup1',
        ticketTypes: [2],
      })
    })
    it('should delete fields field and add columns field', async () => {
      await filter.onFetch([portalInstance])
      expect(portalInstance.value.ticketTypes).toBeUndefined()
      expect(portalInstance.value.ticketTypeIds).toEqual([2])
    })
    it('should not delete fields field and add columns field if enableJSM is false', async () => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableJSM = false
      filter = changePortalGroupFieldsFilter(getFilterParams({ config })) as typeof filter
      await filter.onFetch([portalInstance])
      expect(portalInstance.value.ticketTypes).toBeDefined()
      expect(portalInstance.value.ticketTypeIds).toBeUndefined()
    })
  })
})
