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
import { Change, getChangeData, getDeepInnerType, InstanceElement, isObjectType, ModificationChange, ObjectType, toChange, Value, Values } from '@salto-io/adapter-api'
import { values as lowerdashValues } from '@salto-io/lowerdash'
import _ from 'lodash'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import Joi from 'joi'

type EventValues = {
  event: {
    id: string
  }
  notification: {
    id: string
    notificationType: string
    parameter?: string
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
  }[]
}

type NotificationScheme = {
  notificationSchemeEvents?: NotificationEvent[]
}

const NOTIFICATION_SCHEME = Joi.object({
  notificationSchemeEvents: Joi.array().items(
    Joi.object({
      event: Joi.object({
        id: Joi.number().required(),
      }).unknown(true).required(),
      notifications: Joi.array().items(
        Joi.object({
          notificationType: Joi.string().required(),
        }).unknown(true)
      ).optional(),
    }).unknown(true)
  ).optional(),
}).unknown(true).required()

export const isNotificationScheme = createSchemeGuard<NotificationScheme>(NOTIFICATION_SCHEME, 'Received an invalid notification scheme')

const transformNotificationEvent = (notificationEvent: NotificationEvent): void => {
  notificationEvent.eventType = notificationEvent.event?.id
  delete notificationEvent.event
  notificationEvent.notifications?.forEach((notification: Values) => {
    notification.type = notification.notificationType
    delete notification.notificationType
    delete notification.additionalProperties
    delete notification.user
  })
}

export const transformAllNotificationEvents = (notificationSchemeValues: Values): void => {
  if (!isNotificationScheme(notificationSchemeValues)) {
    throw new Error('Received an invalid notification scheme')
  }
  notificationSchemeValues.notificationSchemeEvents
    ?.forEach(transformNotificationEvent)
}

const getEventKey = (eventEntry: EventValues): string =>
  `${eventEntry.event?.id}-${eventEntry.notification?.notificationType}-${eventEntry.notification?.parameter}`

const getEventsValues = (
  instanceValues: Values,
): EventValues[] =>
  (instanceValues.notificationSchemeEvents ?? [])
    .flatMap((eventEntry: Values) => (eventEntry.notifications ?? []).map((notification: Values) => ({
      event: { id: eventEntry.event?.id },
      notification,
    })))

export const generateNotificationIds = (value: Value): Record<string, string> =>
  _(getEventsValues(value))
    .keyBy(getEventKey)
    .mapValues(({ notification }) => notification?.id)
    .pickBy(lowerdashValues.isDefined)
    .value()


const getEventInstances = (
  instance: InstanceElement,
  eventType: ObjectType,
  notificationSchemeId: string,
): InstanceElement[] =>
  getEventsValues(instance.value)
    .map(eventEntry => new InstanceElement(
      getEventKey(eventEntry),
      eventType,
      {
        notificationSchemeEvents: [{ event: eventEntry.event, notifications: [eventEntry.notification] }],
        // notificaitonIds might not exist
        id: instance.value.notificationIds?.[getEventKey(eventEntry)],
        notificationSchemeId,
      }
    ),)

const getEventType = async (change: Change<InstanceElement>): Promise<ObjectType> => {
  const notificationSchemeType = await getChangeData(change).getType()
  const eventType = await getDeepInnerType(
    await notificationSchemeType.fields.notificationSchemeEvents.getType()
  )

  if (!isObjectType(eventType)) {
    throw new Error('Expected event type to be an object type')
  }

  return eventType
}

export const getEventChanges = async (
  notificationSchemeChange: ModificationChange<InstanceElement>
): Promise<Change<InstanceElement>[]> => {
  const eventType = await getEventType(notificationSchemeChange)
  const eventInstancesBefore = _.keyBy(
    getEventInstances(
      notificationSchemeChange.data.before,
      eventType,
      getChangeData(notificationSchemeChange).value.id
    ),
    instance => instance.elemID.getFullName(),
  )

  const eventInstancesAfter = _.keyBy(
    getEventInstances(
      notificationSchemeChange.data.after,
      eventType,
      getChangeData(notificationSchemeChange).value.id
    ),
    instance => instance.elemID.getFullName(),
  )

  const newEvents = Object.values(eventInstancesAfter)
    .filter(instance => eventInstancesBefore[instance.elemID.getFullName()] === undefined)

  const removedEvents = Object.values(eventInstancesBefore)
    .filter(instance => eventInstancesAfter[instance.elemID.getFullName()] === undefined)

  return [
    ...removedEvents.map(event => toChange({ before: event })),
    ...newEvents.map(event => toChange({ after: event })),
  ]
}
