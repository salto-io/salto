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
  isInstanceChange,
  ChangeValidator,
  getChangeData,
  isRemovalOrModificationChange,
  isRemovalChange,
  Value,
  ChangeError,
  ReferenceExpression,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { getInstancesFromElementSource } from '@salto-io/adapter-utils'
import { values as lowerdashValues } from '@salto-io/lowerdash'
import { TICKET_FIELD_TYPE_NAME, TICKET_FORM_TYPE_NAME } from '../constants'

const { isDefined } = lowerdashValues
const log = logger(module)

type ConditionChildField = {
  id: number | ReferenceExpression
}

type TicketFormCondition = {
  // eslint-disable-next-line camelcase
  parent_field_id: number | ReferenceExpression
  // eslint-disable-next-line camelcase
  child_fields?: ConditionChildField[]
}

const isConditionChildField = (value: Value): value is ConditionChildField =>
  _.isPlainObject(value) && (_.isNumber(value.id) || isReferenceExpression(value.id))

export const isTicketFormCondition = (value: Value): value is TicketFormCondition =>
  _.isPlainObject(value) &&
  (_.isNumber(value.parent_field_id) || isReferenceExpression(value.parent_field_id)) &&
  (value.child_fields === undefined ||
    (_.isArray(value.child_fields) && value.child_fields.every((child: Value) => isConditionChildField(child))))

const TICKET_FORM_CONDITION_FIELDS = ['agent_conditions', 'end_user_conditions']

// At the moment we do not omit inactive ticket_form instances because we need all the instance in order to reorder them
// if we decide to enable this in the inactive.ts file
// we will need to add the warning that is removed
/**
 * Prevent deactivation of a ticket_field that is used as a condition in a ticket form
 */
export const ticketFieldDeactivationValidator: ChangeValidator = async (changes, elementSource) => {
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
  const ticketFieldIdToTicketForm: Record<string, string[]> = {}
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
        // Support both options of resolved and unresolved values
        const parentFieldId = _.isNumber(condition.parent_field_id)
          ? condition.parent_field_id.toString()
          : condition.parent_field_id.elemID.getFullName()
        const childFields = (condition.child_fields ?? []).map(child =>
          _.isNumber(child.id) ? child.id.toString() : child.id.elemID.getFullName(),
        )
        const ticketFieldIds = new Set<string>(childFields.concat(parentFieldId))
        ticketFieldIds.forEach(id => {
          ticketFieldIdToTicketForm[id] = (ticketFieldIdToTicketForm[id] ?? []).concat(ticketForm.elemID.name)
        })
      })
    }),
  )

  const errors = deactivatedTicketFields
    .map((ticketField): ChangeError | undefined => {
      const usingTicketForms = (ticketFieldIdToTicketForm[ticketField.value.id] ?? []).concat(
        ticketFieldIdToTicketForm[ticketField.elemID.getFullName()] ?? [],
      )
      if (usingTicketForms.length === 0) {
        return undefined
      }
      return {
        elemID: ticketField.elemID,
        severity: 'Error',
        message: 'Deactivation of a conditional ticket field',
        detailedMessage: `Cannot remove this ticket field because it is configured as a conditional field in the following ticket forms: ${usingTicketForms.join(', ')}`,
      }
    })
    .filter(isDefined)

  return errors
}
