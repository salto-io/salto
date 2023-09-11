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
  ChangeValidator,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceChange, Value,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { isResolvedReferenceExpression } from '@salto-io/adapter-utils'
import { values } from '@salto-io/lowerdash'
import { TICKET_FORM_TYPE_NAME } from '../constants'
import { isTicketFormCondition } from './ticket_field_deactivation'

const { isDefined } = values

export const conditionalTicketFieldsValidator: ChangeValidator = async changes => {
  const relevantForms = changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(form => form.elemID.typeName === TICKET_FORM_TYPE_NAME)
    .filter(form => form.value.end_user_conditions !== undefined || form.value.agent_conditions !== undefined)
    .filter(form => _.isArray(form.value.ticket_field_ids)) // shouldn't be needed, but used for type checking

  if (relevantForms.length === 0) {
    return []
  }

  const errors = relevantForms.map(form => {
    const existingTicketFieldIds = new Set<number>(form.value.ticket_field_ids
      .filter((id: Value) => _.isNumber(id) || isResolvedReferenceExpression(id))
      .map((id: Value) => (_.isNumber(id) ? id : id.value.id))
      .filter(_.isNumber))

    const conditions = [
      _.isArray(form.value.end_user_conditions) ? form.value.end_user_conditions : [],
      _.isArray(form.value.agent_conditions) ? form.value.agent_conditions : [],
    ].flat().filter(isTicketFormCondition)

    const invalidConditions = conditions.flatMap(condition => [
      condition.parent_field_id,
      (condition.child_fields ?? []).map(child => child.id),
    ]).flat()
      .filter(condition => !existingTicketFieldIds.has(_.isNumber(condition) ? condition : condition.value.id))

    if (invalidConditions.length > 0) {
      const invalidConditionsStr = invalidConditions.map(id => (_.isNumber(id) ? id : id.elemID.name)).join(', ')
      return {
        elemID: form.elemID,
        severity: 'Error',
        message: 'Conditional ticket field not in form\'s tickets',
        detailedMessage: `In order to use a ticket field as a conditonal ticket field, it must be in the ticket_field_ids list, bad fields: ${invalidConditionsStr}`,
      }
    }
    return undefined
  }).filter(isDefined)

  return errors
}
