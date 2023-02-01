/*
*                      Copyright 2023 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import { BuiltinTypes, CORE_ANNOTATIONS, Field, InstanceElement, isInstanceElement, MapType, Values } from '@salto-io/adapter-api'
import _ from 'lodash'
import { values } from '@salto-io/lowerdash'
import { FilterCreator } from '../../filter'
import { NOTIFICATION_SCHEME_TYPE_NAME } from '../../constants'
import { findObject } from '../../utils'
import { getEventKey, getEventsValues, transformAllNotificationEvents } from './notification_events'

const generateNotificationIds = (instance: InstanceElement): Record<string, string> =>
  _(getEventsValues(instance.value))
    .keyBy(getEventKey)
    .mapValues(({ id }) => id)
    .pickBy(values.isDefined)
    .value()

const filter: FilterCreator = () => ({
  name: 'notificationSchemeStructureFilter',
  onFetch: async elements => {
    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === NOTIFICATION_SCHEME_TYPE_NAME)
      .forEach(instance => {
        transformAllNotificationEvents(instance.value)

        instance.value.notificationIds = generateNotificationIds(instance)
        instance.value.notificationSchemeEvents
          ?.forEach((event: Values) => event.notifications?.forEach((notification: Values) => {
            delete notification.id
          }))
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
