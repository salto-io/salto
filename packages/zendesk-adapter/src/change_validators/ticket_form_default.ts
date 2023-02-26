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
import _ from 'lodash'
import { Change, ChangeValidator, getChangeData,
  InstanceElement,
  isAdditionOrModificationChange, isInstanceChange, isInstanceElement, isModificationChange } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'

const { awu } = collections.asynciterable
export const TICKET_FORM_TYPE_NAME = 'ticket_form'

const isRelevantChange = (change: Change<InstanceElement>): boolean =>
  (getChangeData(change).elemID.typeName === TICKET_FORM_TYPE_NAME)
  && (getChangeData(change).value.default === true)
  && !(isModificationChange(change)
    && (change.data.before.value.default === change.data.after.value.default))

export const onlyOneTicketFormDefaultValidator: ChangeValidator = async (
  changes, elementSource
) => {
  const relevantInstances = changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .filter(isRelevantChange)
    .map(getChangeData)
  if (_.isEmpty(relevantInstances) || (elementSource === undefined)) {
    return []
  }
  const allTicketForms = await awu(await elementSource.list())
    .filter(id => id.typeName === TICKET_FORM_TYPE_NAME)
    .filter(id => id.idType === 'instance')
    .map(id => elementSource.get(id))
    .filter(isInstanceElement)
    .toArray()
  return relevantInstances
    .flatMap(instance => {
      const otherDefaultTicketForms = allTicketForms
        .filter(ticketForm => ticketForm.value.default === true)
        .filter(ticketForm => !ticketForm.elemID.isEqual(instance.elemID))
      if (_.isEmpty(otherDefaultTicketForms)) {
        return []
      }
      return [{
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Cannot set this as the default ticket form since another one is already defined as the default',
        detailedMessage: `The following ticket forms are also marked as default: ${otherDefaultTicketForms.map(ticketForm => ticketForm.elemID.getFullName()).join(', ')}`,
      }]
    })
}
