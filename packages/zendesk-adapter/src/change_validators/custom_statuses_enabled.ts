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
  ChangeDataType,
  ChangeError,
  ChangeValidator,
  ElemID,
  getChangeData,
  InstanceElement,
  isInstanceElement,
  ReadOnlyElementsSource,
} from '@salto-io/adapter-api'
import { createSchemeGuardForInstance } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import Joi from 'joi'
import { ACCOUNT_FEATURES_TYPE_NAME, CUSTOM_STATUS_TYPE_NAME, TICKET_FORM_TYPE_NAME, ZENDESK } from '../constants'

const { makeArray } = collections.array

const log = logger(module)
const errorMsg = (reason: string): string => `Failed to run customStatusesEnabledValidator because ${reason}`

type ChildField = {
  // eslint-disable-next-line camelcase
  required_on_statuses?: {
    type: string
    statuses?: string[]
    // eslint-disable-next-line camelcase
    custom_statuses?: unknown[]
  }
}

const CHILD_FIELD_SCHEMA = Joi.object({
  required_on_statuses: Joi.object({
    type: Joi.string().required(),
    statuses: Joi.array().items(Joi.string()),
    custom_statuses: Joi.array(),
  }),
}).unknown()

type Condition = {
  // eslint-disable-next-line camelcase
  child_fields: ChildField[]
}

const CONDITION_SCHEMA = Joi.object({
  child_fields: Joi.array().items(CHILD_FIELD_SCHEMA).required(),
}).unknown()

type TicketFormValue = {
  // eslint-disable-next-line camelcase
  agent_conditions?: Condition[]
}

type TicketForm = InstanceElement & {
  value: TicketFormValue
}

const TICKET_FORM_SCHEMA = Joi.object({
  agent_conditions: Joi.array().items(CONDITION_SCHEMA),
  end_user_conditions: Joi.array().items(CONDITION_SCHEMA),
})
  .unknown()
  .or('agent_conditions', 'end_user_conditions')

const isTicketFormWithConditions = createSchemeGuardForInstance<TicketForm>(TICKET_FORM_SCHEMA)

/**
 * If this function fails to identify whether custom statuses are enabled
 * it will log an error and return true to skip the validator.
 */
const areCustomStatusesEnabled = async (elementSource?: ReadOnlyElementsSource): Promise<boolean> => {
  if (elementSource === undefined) {
    log.error(errorMsg('no element source was provided'))
    return true
  }

  const accountFeatures = await elementSource.get(
    new ElemID(ZENDESK, ACCOUNT_FEATURES_TYPE_NAME, 'instance', ElemID.CONFIG_NAME),
  )

  if (accountFeatures === undefined) {
    log.error(errorMsg('no account features'))
    return true
  }

  if (!isInstanceElement(accountFeatures)) {
    log.error(errorMsg('account features is not an instance element'))
    return true
  }

  const customStatusesEnabled = accountFeatures.value.custom_statuses_enabled
  if (customStatusesEnabled === undefined) {
    log.error(errorMsg('no "custom_statuses_enabled" field'))
    return true
  }

  return customStatusesEnabled.enabled
}

const createErrorsForCustomStatusTypes = (changes: readonly Change<ChangeDataType>[]): ChangeError[] =>
  changes
    .filter(change => getChangeData(change).elemID.typeName === CUSTOM_STATUS_TYPE_NAME)
    .map(getChangeData)
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Error',
      message: 'Custom statuses are not enabled.',
      detailedMessage: 'Cannot deploy custom statuses when they are not enabled in the Zendesk account.',
    }))

const hasConditionWithCustomStatuses = (conditions: Condition[]): boolean =>
  conditions.some((condition: Condition) =>
    condition.child_fields.some(field => makeArray(field.required_on_statuses?.custom_statuses).length > 0),
  )

const isTicketFormWithCustomStatus = (change: Change<ChangeDataType>): boolean => {
  const data = getChangeData(change)
  if (data.elemID.typeName !== TICKET_FORM_TYPE_NAME || !isInstanceElement(data) || !isTicketFormWithConditions(data)) {
    return false
  }

  return hasConditionWithCustomStatuses(
    (data.value.agent_conditions ?? []).concat(data.value.end_user_conditions ?? []),
  )
}

const createErrorsForTicketFormsWithCustomStatuses = (changes: readonly Change<ChangeDataType>[]): ChangeError[] =>
  changes
    .filter(isTicketFormWithCustomStatus)
    .map(getChangeData)
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Warning',
      message: 'Deploying ticket form with custom statuses while custom statuses are disabled',
      detailedMessage:
        'It seems this ticket form originates from another account that has custom statuses enabled. ' +
        'Since custom statuses are disabled in the target account, ' +
        'this ticket form will be deployed without the custom_statuses fields',
    }))

/**
 * Checks that the custom statuses Zendesk feature is enabled before changing
 * instances of type zendesk.custom_status.
 */
export const customStatusesEnabledValidator: ChangeValidator = async (changes, elementSource) => {
  // If custom statuses are enabled (or if we failed to check if custom statuses
  // are enabled) there's no need to check anything else.
  if (await areCustomStatusesEnabled(elementSource)) return []

  return [...createErrorsForCustomStatusTypes(changes), ...createErrorsForTicketFormsWithCustomStatuses(changes)]
}
