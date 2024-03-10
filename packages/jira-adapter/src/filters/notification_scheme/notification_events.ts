/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import {
  Change,
  ElemID,
  getChangeData,
  InstanceElement,
  ModificationChange,
  ObjectType,
  toChange,
  Values,
} from '@salto-io/adapter-api'
import { values as lowerdashValues } from '@salto-io/lowerdash'
import _ from 'lodash'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import Joi from 'joi'
import { JIRA, NOTIFICATION_EVENT_TYPE_NAME } from '../../constants'

type EventValues = {
  event: {
    id: string
  }
  notification: {
    id: string
    notificationType: string
    parameter?: string | { id: string }
  }
}

export type NotificationEvent = {
  event?: {
    id: number
  }
  eventType?: number
  notifications?: {
    notificationType: string
    user?: unknown
    additionalProperties?: unknown
    id?: number
  }[]
}

type NotificationScheme = {
  notificationSchemeEvents?: NotificationEvent[]
}

const NOTIFICATION_SCHEME = Joi.object({
  notificationSchemeEvents: Joi.array()
    .items(
      Joi.object({
        event: Joi.object({
          id: Joi.number().required(),
        })
          .unknown(true)
          .required(),
        notifications: Joi.array()
          .items(
            Joi.object({
              notificationType: Joi.string().required(),
              id: Joi.number().optional(),
            }).unknown(true),
          )
          .optional(),
      }).unknown(true),
    )
    .optional(),
})
  .unknown(true)
  .required()

export const isNotificationScheme = createSchemeGuard<NotificationScheme>(
  NOTIFICATION_SCHEME,
  'Received an invalid notification scheme',
)

export const transformNotificationEvent = (notificationEvent: NotificationEvent): void => {
  notificationEvent.eventType = notificationEvent.event?.id
  delete notificationEvent.event
  notificationEvent.notifications?.forEach((notification: Values) => {
    notification.type = notification.notificationType
    delete notification.notificationType
    delete notification.additionalProperties
    delete notification.user
    delete notification.id
  })
}

const getEventParameter = (eventEntry: EventValues): string | undefined =>
  typeof eventEntry.notification?.parameter === 'object' && 'id' in eventEntry.notification.parameter
    ? eventEntry.notification.parameter.id
    : eventEntry.notification?.parameter

const getEventKey = (eventEntry: EventValues): string =>
  `${eventEntry.event?.id}-${eventEntry.notification?.notificationType}-${getEventParameter(eventEntry)}`

const getEventsValues = (notificationEvents: NotificationEvent[]): EventValues[] =>
  notificationEvents.flatMap((eventEntry: Values) =>
    (eventEntry.notifications ?? []).map((notification: Values) => ({
      event: { id: eventEntry.event?.id },
      notification,
    })),
  )

export const generateNotificationIds = (notificationEvents: NotificationEvent[]): Record<string, string> =>
  _(getEventsValues(notificationEvents))
    .keyBy(getEventKey)
    .mapValues(({ notification }) => notification?.id)
    .pickBy(lowerdashValues.isDefined)
    .value()

const getEventInstances = (
  instance: InstanceElement,
  eventType: ObjectType,
  notificationSchemeId: string,
): InstanceElement[] => {
  const { value } = instance
  if (!isNotificationScheme(value)) {
    throw new Error(
      `received invalid structure for notificationSchemeEvents in instance ${instance.elemID.getFullName()}`,
    )
  }
  return getEventsValues(value.notificationSchemeEvents ?? []).map(
    eventEntry =>
      new InstanceElement(getEventKey(eventEntry), eventType, {
        notificationSchemeEvents: [{ event: eventEntry.event, notifications: [eventEntry.notification] }],
        // notificaitonIds might not exist
        id: instance.value.notificationIds?.[getEventKey(eventEntry)],
        notificationSchemeId,
      }),
  )
}

export const getEventChangesToDeploy = (
  notificationSchemeChange: ModificationChange<InstanceElement>,
): Change<InstanceElement>[] => {
  const eventType = new ObjectType({ elemID: new ElemID(JIRA, NOTIFICATION_EVENT_TYPE_NAME) })
  const eventInstancesBefore = _.keyBy(
    getEventInstances(
      notificationSchemeChange.data.before,
      eventType,
      getChangeData(notificationSchemeChange).value.id,
    ),
    instance => instance.elemID.getFullName(),
  )

  const eventInstancesAfter = _.keyBy(
    getEventInstances(notificationSchemeChange.data.after, eventType, getChangeData(notificationSchemeChange).value.id),
    instance => instance.elemID.getFullName(),
  )

  const newEvents = Object.values(eventInstancesAfter).filter(
    instance => eventInstancesBefore[instance.elemID.getFullName()] === undefined,
  )

  const removedEvents = Object.values(eventInstancesBefore).filter(
    instance => eventInstancesAfter[instance.elemID.getFullName()] === undefined,
  )

  return [
    ...removedEvents.map(event => toChange({ before: event })),
    ...newEvents.map(event => toChange({ after: event })),
  ]
}
