/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { AdditionChange, Change, getChangeData, getDeepInnerType, InstanceElement, isAdditionChange, isModificationChange, isObjectType, isRemovalChange, ModificationChange, ObjectType, toChange, Values } from '@salto-io/adapter-api'
import { values as lowerdashValues } from '@salto-io/lowerdash'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { resolveChangeElement } from '@salto-io/adapter-utils'
import { getFilledJspUrls } from '../../utils'
import JiraClient from '../../client/client'
import { JiraConfig } from '../../config'
import { deployWithJspEndpoints } from '../../deployment/jsp_deployment'
import { NOTIFICATION_EVENT_TYPE_NAME } from '../../constants'
import { getLookUpName } from '../../reference_mapping'

const log = logger(module)

type EventValues = {
  eventType: string
  type: string
  parameter?: unknown
  id?: string
}

const EVENT_TYPES: Record<string, string> = {
  ProjectLead: 'Project_Lead',
  CurrentAssignee: 'Current_Assignee',
  Reporter: 'Current_Reporter',
  CurrentUser: 'Remote_User',
  ComponentLead: 'Component_Lead',
  User: 'Single_User',
  Group: 'Group_Dropdown',
  ProjectRole: 'Project_Role',
  EmailAddress: 'Single_Email_Address',
  AllWatchers: 'All_Watchers',
  UserCustomField: 'User_Custom_Field_Value',
  GroupCustomField: 'Group_Custom_Field_Value',
}

const transformNotificationEvent = (notificationEvent: Values): void => {
  notificationEvent.eventType = notificationEvent.event.id
  delete notificationEvent.event
  notificationEvent.notifications?.forEach((notification: Values) => {
    notification.type = notification.notificationType
    delete notification.notificationType
    delete notification.additionalProperties
    delete notification.user
  })
}

export const transformAllNotificationEvents = (notificationSchemeValues: Values): void => {
  notificationSchemeValues.notificationSchemeEvents
    ?.forEach(transformNotificationEvent)
}

const convertValuesToJSPBody = (values: Values, instance: InstanceElement): Values => {
  const type = EVENT_TYPES[values.type] ?? values.type

  return _.pickBy({
    id: values.id,
    schemeId: instance.value.id,
    name: values.name,
    eventTypeIds: values.eventType,
    type,
    [type]: values.parameter?.toString(),
  }, lowerdashValues.isDefined)
}

export const getEventKey = (event: EventValues): string =>
  `${event.eventType}-${event.type}-${event.parameter}`

export const getEventsValues = (
  instanceValues: Values,
): EventValues[] =>
  (instanceValues.notificationSchemeEvents ?? [])
    .flatMap((event: Values) => (event.notifications ?? []).map((notification: Values) => ({
      eventType: event.eventType,
      type: notification.type,
      parameter: notification.parameter,
      id: notification.id,
    })))

const getEventInstances = (
  instance: InstanceElement,
  eventType: ObjectType,
): InstanceElement[] =>
  getEventsValues(instance.value)
    .map(event => new InstanceElement(
      getEventKey(event),
      eventType,
      convertValuesToJSPBody({
        ...event,
        name: getEventKey(event),
        id: instance.value.notificationIds?.[getEventKey(event)],
      }, instance),
    ))

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

const getEventChanges = async (
  change: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>
): Promise<Change<InstanceElement>[]> => {
  const eventType = await getEventType(change)
  const eventInstancesBefore = _.keyBy(
    isModificationChange(change)
      ? getEventInstances(change.data.before, eventType)
      : [],
    instance => instance.elemID.getFullName(),
  )

  const eventInstancesAfter = _.keyBy(
    getEventInstances(change.data.after, eventType),
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

export const deployEvents = async (
  change: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>,
  client: JiraClient,
  config: JiraConfig,
): Promise<void> => {
  const eventChanges = await getEventChanges(await resolveChangeElement(change, getLookUpName))
  const instance = getChangeData(change)

  const urls = getFilledJspUrls(instance, config, NOTIFICATION_EVENT_TYPE_NAME)

  const res = await deployWithJspEndpoints({
    changes: eventChanges,
    client,
    urls,
    queryFunction: async () => {
      if (urls.query === undefined) {
        throw new Error(`${NOTIFICATION_EVENT_TYPE_NAME} is missing a JSP query url`)
      }
      const response = await client.getSinglePage({ url: urls.query })
      if (Array.isArray(response.data)) {
        throw new Error(`Received unexpected response from ${NOTIFICATION_EVENT_TYPE_NAME}`)
      }
      transformAllNotificationEvents(response.data)
      return getEventsValues(response.data)
        .map(event => ({ ...event, name: getEventKey(event) }))
        .map(eventValues => convertValuesToJSPBody(eventValues, instance))
    },
  })

  eventChanges.forEach(eventChange => {
    const eventInstance = getChangeData(eventChange)
    if (isRemovalChange(eventChange)) {
      delete instance.value.notificationIds[eventInstance.value.name]
    }

    if (isAdditionChange(eventChange)) {
      if (instance.value.notificationIds === undefined) {
        instance.value.notificationIds = {}
      }
      instance.value.notificationIds[eventInstance.value.name] = eventInstance.value.id
    }
  })

  if (res.errors.length !== 0) {
    log.error(`Failed to deploy notification scheme events of ${instance.elemID.getFullName()}: ${res.errors.join(', ')}`)
    throw new Error(`Failed to deploy notification scheme events of ${instance.elemID.getFullName()}`)
  }
}
