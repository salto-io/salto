/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { BuiltinTypes, CORE_ANNOTATIONS, Field, MapType, isInstanceElement } from '@salto-io/adapter-api'
import { FilterCreator } from '../../filter'
import { NOTIFICATION_SCHEME_TYPE_NAME } from '../../constants'
import { findObject } from '../../utils'
import { transformNotificationEvent, generateNotificationIds, isNotificationScheme } from './notification_events'

/**
 * The filter stores a hidden map of notification ids for each NotificationSchemeEvent
 */
const filter: FilterCreator = () => ({
  name: 'notificationSchemeStructureFilter',
  onFetch: async elements => {
    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === NOTIFICATION_SCHEME_TYPE_NAME)
      .forEach(instance => {
        const { value } = instance
        if (isNotificationScheme(value) && value.notificationSchemeEvents) {
          instance.value.notificationIds = generateNotificationIds(value.notificationSchemeEvents)
          value.notificationSchemeEvents.forEach(transformNotificationEvent)
        }
      })

    const notificationSchemeType = findObject(elements, NOTIFICATION_SCHEME_TYPE_NAME)
    if (notificationSchemeType === undefined) {
      return
    }

    notificationSchemeType.fields.notificationIds = new Field(
      notificationSchemeType,
      'notificationIds',
      new MapType(BuiltinTypes.NUMBER),
      { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true },
    )
  },
})

export default filter
