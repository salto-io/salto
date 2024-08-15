/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { getFilterParams, mockClient } from '../../utils'
import notificationSchemeStructureFilter from '../../../src/filters/notification_scheme/notification_scheme_structure'
import { JIRA, NOTIFICATION_SCHEME_TYPE_NAME } from '../../../src/constants'

describe('notificationSchemeStructureFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  let notificationSchemeType: ObjectType
  let instance: InstanceElement

  beforeEach(async () => {
    const { client, paginator } = mockClient()

    filter = notificationSchemeStructureFilter(
      getFilterParams({
        client,
        paginator,
      }),
    ) as filterUtils.FilterWith<'onFetch'>

    notificationSchemeType = new ObjectType({
      elemID: new ElemID(JIRA, NOTIFICATION_SCHEME_TYPE_NAME),
    })

    instance = new InstanceElement('instance', notificationSchemeType, {
      notificationSchemeEvents: [
        {
          event: {
            id: '1',
          },
          notifications: [
            {
              id: '2',
              notificationType: 'type',
              parameter: 'parameter',
              user: 'user',
            },
          ],
        },
      ],
    })
  })

  describe('onFetch', () => {
    it('should add notificationIds field', async () => {
      await filter.onFetch([notificationSchemeType])
      expect(notificationSchemeType.fields.notificationIds.annotations).toEqual({
        [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
      })
    })

    it('should transform notifications', async () => {
      await filter.onFetch([instance])
      expect(instance.value.notificationSchemeEvents).toEqual([
        {
          eventType: '1',
          notifications: [
            {
              type: 'type',
              parameter: 'parameter',
            },
          ],
        },
      ])
    })

    it('should do nothing when there are no notifications', async () => {
      delete instance.value.notificationSchemeEvents[0].notifications
      await filter.onFetch([instance])
      expect(instance.value.notificationSchemeEvents).toEqual([
        {
          eventType: '1',
        },
      ])
    })

    it('should do nothing when there are no notificationSchemeEvents', async () => {
      delete instance.value.notificationSchemeEvents
      await filter.onFetch([instance])
      expect(instance.value.notificationSchemeEvents).toBeUndefined()
    })

    it('should add notificationIds', async () => {
      await filter.onFetch([instance])
      expect(instance.value.notificationIds).toEqual({
        '1-type-parameter': '2',
      })
    })
  })
})
