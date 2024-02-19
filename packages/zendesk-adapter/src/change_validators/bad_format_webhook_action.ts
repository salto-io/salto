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
import {
  ChangeError,
  ChangeValidator,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceChange,
} from '@salto-io/adapter-api'
import { values as lowerDashValues } from '@salto-io/lowerdash'
import joi from 'joi'
import { AUTOMATION_TYPE_NAME, TRIGGER_TYPE_NAME } from '../constants'

const { isDefined } = lowerDashValues

type notificationWebhookAction = {
  field: string
  value: unknown
}

const notificationWebhookAction = joi
  .object({
    field: joi.string().valid('notification_webhook').required(),
    value: joi.any().required(),
  })
  .unknown(true)

const isNotificationWebhookAction = (value: unknown): value is notificationWebhookAction =>
  notificationWebhookAction.validate(value).error === undefined

const POTENTIAL_BAD_FORMAT_TYPES = [AUTOMATION_TYPE_NAME, TRIGGER_TYPE_NAME]

/**
 * Validate that automation and trigger with notification_webhook actions, have the correct value type of an array.
 */
export const badFormatWebhookActionValidator: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(instance => POTENTIAL_BAD_FORMAT_TYPES.includes(instance.elemID.typeName))
    .filter(instance => _.isArray(instance.value.actions))
    .map((instance): ChangeError | undefined => {
      const webhookActions = instance.value.actions.filter(isNotificationWebhookAction)
      if (webhookActions.some((action: notificationWebhookAction) => !_.isArray(action.value))) {
        const { typeName } = instance.elemID
        return {
          elemID: instance.elemID,
          severity: 'Warning',
          message: `${typeName} instance has unexpected structure and might not work properly`,
          detailedMessage: `The instance have an action of notification_webhook with a value in a bad format (should be an array). This might cause the ${typeName} to not work properly.`,
        }
      }
      return undefined
    })
    .filter(isDefined)
