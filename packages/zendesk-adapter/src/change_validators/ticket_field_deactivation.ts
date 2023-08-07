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
import {
  isInstanceChange,
  ChangeValidator,
  getChangeData,
  isRemovalOrModificationChange,
  isRemovalChange, Value, ChangeError,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { getInstancesFromElementSource } from '@salto-io/adapter-utils'
import { config as configUtils } from '@salto-io/adapter-components'
import { TICKET_FIELD_TYPE_NAME, TICKET_FORM_TYPE_NAME } from '../constants'
import { ZendeskApiConfig } from '../config'

const log = logger(module)

type ConditionChildField = {
  id: number
}

type TicketFormCondition = {
  // eslint-disable-next-line camelcase
  parent_field_id: number
  // eslint-disable-next-line camelcase
  child_fields?: ConditionChildField[]
}

const isConditionChildField = (value: Value): value is ConditionChildField =>
  _.isPlainObject(value) && _.isNumber(value.id)

const isTicketFormCondition = (value: Value): value is TicketFormCondition =>
  _.isPlainObject(value)
  && _.isNumber(value.parent_field_id)
  && (
    value.child_fields === undefined
    || (_.isArray(value.child_fields) && value.child_fields.every((child: Value) => isConditionChildField(child)))
  )

const TICKET_FORM_CONDITION_FIELDS = ['agent_conditions', 'end_user_conditions']

/**
 * Prevent deactivation of a ticket_field that is used as a condition in a ticket form
 */
export const ticketFieldDeactivationValidator: (apiConfig: ZendeskApiConfig)
  => ChangeValidator = apiConfig => async (changes, elementSource) => {
    if (elementSource === undefined) {
      log.error('Failed to run ticketFieldDeactivationValidator because element source is undefined')
      return []
    }

    const deactivatedTicketFields = changes
      .filter(isInstanceChange)
      .filter(isRemovalOrModificationChange)
      .filter(change => getChangeData(change).elemID.typeName === TICKET_FIELD_TYPE_NAME)
      .filter(change => change.data.before.value.active === true)
      // Removal also counts as deactivation
      .filter(change => isRemovalChange(change) || change.data.after.value.active === false)
      .map(getChangeData)

    if (deactivatedTicketFields.length === 0) {
      return []
    }

    const ticketForms = await getInstancesFromElementSource(elementSource, [TICKET_FORM_TYPE_NAME])
    const ticketFieldIdToTicketForm: Record<number, string[]> = {}
    // TICKET_FORM_CONDITION_FIELDS has 'parent_field_id' in them
    // Each condition also may (or must?) have 'child_fields' with 'id' in them
    ticketForms.forEach(ticketForm =>
      TICKET_FORM_CONDITION_FIELDS.forEach(field => {
        const conditions = ticketForm.value[field]
        if (conditions === undefined) {
          return
        }

        if (!_.isArray(conditions)) {
          log.error(`${field} is not an array in ${ticketForm.elemID.getFullName()}`)
          return
        }

        conditions.forEach((condition: Value) => {
          if (!isTicketFormCondition(condition)) {
            log.error(`${field} has an invalid format in ${ticketForm.elemID.getFullName()}}`)
            return
          }
          const ticketFieldIds = new Set<number>(
            [condition.parent_field_id, ...(condition.child_fields ?? []).map(ticketField => ticketField.id)]
          )
          ticketFieldIds.forEach(id => {
            ticketFieldIdToTicketForm[id] = [...ticketFieldIdToTicketForm[id] ?? [], ticketForm.elemID.name]
          })
        })
      }))

    const inactiveTicketFormsOmitted = configUtils.getConfigWithDefault(
      apiConfig.types?.[TICKET_FORM_TYPE_NAME]?.transformation,
      apiConfig.typeDefaults?.transformation
    ).omitInactive === true

    // Even inactive ticket form prevents deactivation of a ticket field
    // If they are omitted, we can only warn about the deactivation
    const warnings: ChangeError[] = inactiveTicketFormsOmitted
      ? deactivatedTicketFields.map(ticketField => ({
        elemID: ticketField.elemID,
        severity: 'Warning',
        message: 'Deactivation of a ticket field',
        detailedMessage: 'This ticket field may be a conditional ticket field of an omitted deactivated ticket form, if true, the deployment will fail',
      }))
      : []

    const errors: ChangeError[] = deactivatedTicketFields
      .filter(ticketField => ticketFieldIdToTicketForm[ticketField.value.id])
      .map(ticketField => ({
        elemID: ticketField.elemID,
        severity: 'Error',
        message: 'Deactivation of a conditional ticket field',
        detailedMessage: `This ticket field is a conditional ticket field of ticket forms, and cannot be removed, ticket forms: ${ticketFieldIdToTicketForm[ticketField.value.id].join(', ')}`,
      }))

    return errors.concat(warnings)
  }
