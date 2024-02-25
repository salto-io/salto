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
  ChangeError,
  ChangeValidator,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceChange,
  ReferenceExpression,
  Value,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { isResolvedReferenceExpression } from '@salto-io/adapter-utils'
import { values } from '@salto-io/lowerdash'
import { TICKET_FORM_TYPE_NAME } from '../constants'
import { isTicketFormCondition } from './ticket_field_deactivation'

const { isDefined } = values

const extractId = (id: number | ReferenceExpression): number => (_.isNumber(id) ? id : id.value.value.id)

/**
 * When deploying a ticket form, validate that all conditional ticket fields are in the form's ticket field ids list
 */
export const conditionalTicketFieldsValidator: ChangeValidator = async changes => {
  const relevantForms = changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(form => form.elemID.typeName === TICKET_FORM_TYPE_NAME)
    .filter(form => form.value.end_user_conditions !== undefined || form.value.agent_conditions !== undefined)
    .filter(form => _.isArray(form.value.ticket_field_ids)) // used for type checking

  if (relevantForms.length === 0) {
    return []
  }

  const errors = relevantForms
    .map((form): ChangeError | undefined => {
      const existingTicketFieldIds = new Set(
        form.value.ticket_field_ids
          .filter((id: Value) => _.isNumber(id) || isResolvedReferenceExpression(id))
          .map(extractId),
      )

      const conditions = [
        _.isArray(form.value.end_user_conditions) ? form.value.end_user_conditions : [],
        _.isArray(form.value.agent_conditions) ? form.value.agent_conditions : [],
      ]
        .flat()
        .filter(isTicketFormCondition)

      const invalidConditions = conditions
        .flatMap(condition => [condition.parent_field_id, (condition.child_fields ?? []).map(child => child.id)])
        .flat()
        .filter(condition => _.isNumber(condition) || isResolvedReferenceExpression(condition))
        .filter(condition => !existingTicketFieldIds.has(extractId(condition)))

      if (invalidConditions.length > 0) {
        const invalidConditionsStr = _.uniq(invalidConditions.map(id => (_.isNumber(id) ? id : id.elemID.name))).join(
          ', ',
        )
        return {
          elemID: form.elemID,
          severity: 'Error',
          message: "The conditional ticket field is not present in the form's ticket_field_ids",
          detailedMessage: `To utilize a ticket field as a conditional ticket field, it must be included in the 'ticket_field_ids' list. Invalid fields include: ${invalidConditionsStr}`,
        }
      }
      return undefined
    })
    .filter(isDefined)

  return errors
}
