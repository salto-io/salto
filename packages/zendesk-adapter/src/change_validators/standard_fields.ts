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
  isInstanceChange,
  isModificationChange,
} from '@salto-io/adapter-api'
import { detailedCompare } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { TICKET_FIELD_TYPE_NAME } from '../constants'

const STANDARD_FIELDS = ['tickettype', 'status', 'priority', 'group', 'description', 'assignee', 'subject']
const NON_EDITABLE_FIELDS = ['type', 'raw_title']

/**
 * Validates that standard ticket fields are not added or removed,
 * or that their non-editable fields are not modified
 */
export const standardFieldsValidator: ChangeValidator = async changes => {
  const relevantChanges = changes
    .filter(isInstanceChange)
    .filter(change => getChangeData(change).elemID.typeName === TICKET_FIELD_TYPE_NAME)
    .filter(change => STANDARD_FIELDS.includes(getChangeData(change).value.type))

  const [modifications, additionsRemovals] = _.partition(relevantChanges, isModificationChange)

  const invalidModifications = modifications.filter(change => {
    const detailedChanges = detailedCompare(change.data.before, change.data.after)
    return detailedChanges.some(detailedChange => NON_EDITABLE_FIELDS.includes(detailedChange.id.name))
  })

  return additionsRemovals
    .map(
      (change): ChangeError => ({
        elemID: getChangeData(change).elemID,
        severity: 'Error',
        message: 'Cannot add or remove standard ticket fields',
        detailedMessage: 'Standard ticket fields cannot be added or removed in Zendesk',
      }),
    )
    .concat(
      invalidModifications.map(change => ({
        elemID: getChangeData(change).elemID,
        severity: 'Error',
        message: `Cannot edit [${NON_EDITABLE_FIELDS.join(', ')}] fields of standard ticket fields`,
        detailedMessage: `Editing [${NON_EDITABLE_FIELDS.join(', ')}] fields of standard ticket fields is not supported in Zendesk`,
      })),
    )
}
