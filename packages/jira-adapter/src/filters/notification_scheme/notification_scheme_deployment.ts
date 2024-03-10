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
import _ from 'lodash'
import Joi from 'joi'
import {
  Change,
  Element,
  InstanceElement,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceChange,
  isModificationChange,
} from '@salto-io/adapter-api'
import { applyFunctionToChangeData, createSchemeGuard, restoreChangeElement } from '@salto-io/adapter-utils'
import { resolveValues } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { findObject, setFieldDeploymentAnnotations, setTypeDeploymentAnnotations } from '../../utils'
import { FilterCreator } from '../../filter'
import { NOTIFICATION_EVENT_TYPE_NAME, NOTIFICATION_SCHEME_TYPE_NAME } from '../../constants'
import { defaultDeployChange, deployChanges } from '../../deployment/standard_deployment'
import JiraClient from '../../client/client'
import {
  getEventChangesToDeploy,
  generateNotificationIds,
  isNotificationScheme,
  NotificationEvent,
  transformNotificationEvent,
} from './notification_events'
import { getLookUpName } from '../../reference_mapping'

const { awu } = collections.asynciterable
const log = logger(module)

type NotificationEventValue = {
  eventType: number
  notifications?: {
    type: string
  }[]
}[]

const NOTIFICATION_EVENT_VALUE_SCHEME = Joi.array().items(
  Joi.object({
    eventType: Joi.number().required(),
    notifications: Joi.array()
      .items(
        Joi.object({
          type: Joi.string().required(),
        }).unknown(true),
      )
      .optional(),
  }).unknown(true),
)

const isNotificationEventValue = createSchemeGuard<NotificationEventValue>(
  NOTIFICATION_EVENT_VALUE_SCHEME,
  'Found an invalid notificationEventScheme value',
)

const toDeployableNotificationEvent = (eventEntries: NotificationEventValue): NotificationEvent[] =>
  eventEntries.map(eventEntry => ({
    event: { id: eventEntry.eventType },
    notifications: eventEntry.notifications?.map(notification => ({
      notificationType: notification.type,
      ..._.omit(notification, 'type'),
    })),
  }))

const assignEventIds = async (change: Change<InstanceElement>, client: JiraClient): Promise<void> => {
  const notificationSchemeId = getChangeData(change).value.id
  const { data } = await client.get({
    url: `/rest/api/3/notificationscheme/${notificationSchemeId}`,
    queryParams: { expand: 'all' },
  })
  if (!isNotificationScheme(data)) {
    log.error(`Failed to assign event ids after deployment to NotificationScheme with id: ${notificationSchemeId}`)
    throw new Error(`Received unexpected response from ${NOTIFICATION_EVENT_TYPE_NAME}`)
  }
  await applyFunctionToChangeData<Change<InstanceElement>>(change, async instance => {
    if (data.notificationSchemeEvents) {
      instance.value.notificationIds = generateNotificationIds(data.notificationSchemeEvents)
    }
    return instance
  })
}

const filter: FilterCreator = ({ client, config }) => {
  const originalChanges: Record<string, Change<InstanceElement>> = {}
  return {
    name: 'notificationSchemeDeploymentFilter',
    onFetch: async (elements: Element[]) => {
      const notificationSchemeType = findObject(elements, NOTIFICATION_SCHEME_TYPE_NAME)
      if (notificationSchemeType !== undefined) {
        setTypeDeploymentAnnotations(notificationSchemeType)
        setFieldDeploymentAnnotations(notificationSchemeType, 'id')
        setFieldDeploymentAnnotations(notificationSchemeType, 'name')
        setFieldDeploymentAnnotations(notificationSchemeType, 'description')
        setFieldDeploymentAnnotations(notificationSchemeType, 'notificationSchemeEvents')
      }

      const notificationEventType = findObject(elements, NOTIFICATION_EVENT_TYPE_NAME)
      if (notificationEventType !== undefined) {
        setFieldDeploymentAnnotations(notificationEventType, 'eventType')
        setFieldDeploymentAnnotations(notificationEventType, 'notifications')
      }
    },

    // NotificationScheme structure was converted in notificationSchemeStructureFilter
    preDeploy: async changes => {
      if (client.isDataCenter) {
        return
      }
      const relevantChanges = changes
        .filter(isInstanceChange)
        .filter(isAdditionOrModificationChange)
        .filter(instance => getChangeData(instance).elemID.typeName === NOTIFICATION_SCHEME_TYPE_NAME)

      const changesToReturn = await awu(relevantChanges)
        .map(async change => {
          originalChanges[getChangeData(change).elemID.getFullName()] = change
          return applyFunctionToChangeData<Change<InstanceElement>>(change, async instance => {
            // We need to resolve references before we change instance structure
            const resolvedInstance = await resolveValues(instance, getLookUpName)
            const { notificationSchemeEvents } = resolvedInstance.value
            if (notificationSchemeEvents && isNotificationEventValue(notificationSchemeEvents)) {
              resolvedInstance.value.notificationSchemeEvents = toDeployableNotificationEvent(notificationSchemeEvents)
            }
            return resolvedInstance
          })
        })
        .toArray()

      _.pullAll(changes, relevantChanges)
      changesToReturn.forEach(change => changes.push(change))
    },

    deploy: async changes => {
      if (client.isDataCenter) {
        return {
          leftoverChanges: changes,
          deployResult: {
            appliedChanges: [],
            errors: [],
          },
        }
      }
      const [relevantChanges, leftoverChanges] = _.partition(
        changes,
        change => isInstanceChange(change) && getChangeData(change).elemID.typeName === NOTIFICATION_SCHEME_TYPE_NAME,
      )

      const deployResult = await deployChanges(relevantChanges.filter(isInstanceChange), async change => {
        await defaultDeployChange({
          change,
          client,
          apiDefinitions: config.apiDefinitions,
        })
        if (isModificationChange(change)) {
          const eventChanges = getEventChangesToDeploy(change)
          await awu(eventChanges).forEach(async eventChange => {
            await defaultDeployChange({
              change: eventChange,
              client,
              apiDefinitions: config.apiDefinitions,
            })
          })
        }
        if (isAdditionOrModificationChange(change)) {
          // we should store created event ids in instance.value.notificationIds mapping
          await assignEventIds(change, client)
        }
      })

      return {
        leftoverChanges,
        deployResult,
      }
    },

    // NotificationScheme structure was converted in notificationSchemeStructureFilter
    onDeploy: async changes => {
      if (client.isDataCenter) {
        return
      }
      const relevantChanges = changes
        .filter(isInstanceChange)
        .filter(isAdditionOrModificationChange)
        .filter(instance => getChangeData(instance).elemID.typeName === NOTIFICATION_SCHEME_TYPE_NAME)

      const changesToReturn = await awu(relevantChanges)
        .map(async change => {
          await applyFunctionToChangeData<Change<InstanceElement>>(change, instance => {
            const { value } = instance
            if (!isNotificationScheme(value)) {
              throw new Error('Received an invalid notification scheme')
            }
            value.notificationSchemeEvents?.forEach(transformNotificationEvent)
            return instance
          })
          return restoreChangeElement(change, originalChanges, getLookUpName)
        })
        .toArray()

      _.pullAll(changes, relevantChanges)
      changesToReturn.forEach(change => changes.push(change))
    },
  }
}

export default filter
