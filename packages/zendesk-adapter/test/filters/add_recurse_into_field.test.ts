/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { filterUtils } from '@salto-io/adapter-components'
import { ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/add_recurse_into_field'
import { ZENDESK } from '../../src/constants'
import { createFilterCreatorParams } from '../utils'
import { DEFAULT_CONFIG, FETCH_CONFIG, ZendeskConfig } from '../../src/config'
import ZendeskClient from '../../src/client/client'

describe('add empty recurseInto fields in new infra', () => {
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType
  let client: ZendeskClient
  let oldInfraConfig: ZendeskConfig

  const businessHoursScheduleTypeName = 'business_hours_schedule'
  const routingAttributeTypeName = 'routing_attribute'
  const groupTypeName = 'group'

  const businessHoursScheduleType = new ObjectType({ elemID: new ElemID(ZENDESK, businessHoursScheduleTypeName) })
  const routingAttributeType = new ObjectType({ elemID: new ElemID(ZENDESK, routingAttributeTypeName) })
  const groupType = new ObjectType({ elemID: new ElemID(ZENDESK, groupTypeName) })

  beforeEach(async () => {
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
    })
    oldInfraConfig = {
      ...DEFAULT_CONFIG,
      fetch: {
        ...DEFAULT_CONFIG[FETCH_CONFIG],
        useNewInfra: false,
      },
    }
  })

  describe('onFetch', () => {
    it('should add fields when using new infra correctly', async () => {
      filter = filterCreator(createFilterCreatorParams({ client, config: DEFAULT_CONFIG })) as FilterType

      const businessHoursScheduleInstance = new InstanceElement('instance1', businessHoursScheduleType, {
        name: 'business hours schedule',
      })
      const routingAttributeInstance = new InstanceElement('instance2', routingAttributeType, {
        name: 'routing attribute name',
      })

      const elements = [businessHoursScheduleInstance, routingAttributeInstance]
      await filter.onFetch(elements)
      expect(businessHoursScheduleInstance.value.holidays).toEqual([])
      expect(routingAttributeInstance.value.values).toEqual([])
    })
    it('should not add fields when using the old infra', async () => {
      filter = filterCreator(createFilterCreatorParams({ client, config: oldInfraConfig })) as FilterType

      const businessHoursScheduleInstance = new InstanceElement('instance1', businessHoursScheduleType, {
        name: 'business hours schedule',
      })
      const routingAttributeInstance = new InstanceElement('instance2', routingAttributeType, {
        name: 'routing attribute name',
      })
      const clonedBusinessHoursScheduleInstance = businessHoursScheduleInstance.clone()
      const clonedRoutingAttributeInstance = routingAttributeInstance.clone()

      const elements = [businessHoursScheduleInstance, routingAttributeInstance]
      await filter.onFetch(elements)
      expect(businessHoursScheduleInstance).toEqual(clonedBusinessHoursScheduleInstance)
      expect(routingAttributeInstance).toEqual(clonedRoutingAttributeInstance)
    })
    it('should not add new fields when object types do not align', async () => {
      filter = filterCreator(createFilterCreatorParams({ client, config: DEFAULT_CONFIG })) as FilterType
      const groupInstance = new InstanceElement('instance3', groupType, {
        name: 'business hours schedule',
      })
      const clonedGroupInstance = groupInstance.clone()
      const elements = [groupInstance]
      await filter.onFetch(elements)
      expect(groupInstance).toEqual(clonedGroupInstance)
    })
  })
})
