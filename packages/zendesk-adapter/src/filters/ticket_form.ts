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
import {
  Change, DeployResult,
  getChangeData,
  InstanceElement, isAdditionChange, isAdditionOrModificationChange, isInstanceChange, isModificationChange, toChange,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { FilterCreator } from '../filter'
import { deployChange, deployChanges } from '../deployment'

export const TICKET_FORM_TYPE_NAME = 'ticket_form'
const SOME_STATUSES = 'SOME_STATUSES'


type Child = {
  // eslint-disable-next-line camelcase
  required_on_statuses: {
    type: string
    statuses?: string[]
    // eslint-disable-next-line camelcase
    custom_statuses?: number[]
  }
}

type TicketForm = {
  // eslint-disable-next-line camelcase
  agent_conditions: {
    // eslint-disable-next-line camelcase
    child_fields: Child[]
  }[]
}

/**
 * checks if both statuses and custom_statuses are defined
 */
const isInvalidTicketForm = (instanceValue: Record<string, unknown>): instanceValue is TicketForm =>
  _.isArray(instanceValue.agent_conditions)
  && instanceValue.agent_conditions.some(condition =>
    _.isArray(condition.child_fields)
      && condition.child_fields.some((child: Child) =>
        _.isObject(child.required_on_statuses)
        && child.required_on_statuses.type === SOME_STATUSES
        && (child.required_on_statuses.statuses !== undefined) // even if it is an empty array it is not valid
        && (child.required_on_statuses.custom_statuses !== undefined
        && !_.isEmpty(child.required_on_statuses.custom_statuses))))

const invalidTicketFormChange = (change: Change<InstanceElement>): boolean =>
  TICKET_FORM_TYPE_NAME === getChangeData(change).elemID.typeName
  && isAdditionOrModificationChange(change)
  && isInstanceChange(change)
  && isInvalidTicketForm(getChangeData(change).value)

const returnValidInstance = (arg: InstanceElement): InstanceElement => {
  const clonedArg = arg.clone()
  if (isInvalidTicketForm(clonedArg.value)) {
    clonedArg.value.agent_conditions
      .forEach(condition => condition.child_fields
        .forEach(child => {
          if (child.required_on_statuses.type === SOME_STATUSES
            && (child.required_on_statuses.statuses !== undefined)
            && (child.required_on_statuses.custom_statuses !== undefined
              && !_.isEmpty(child.required_on_statuses.custom_statuses))) {
            delete child.required_on_statuses.statuses
          }
        }))
  }
  return clonedArg
}


const filterCreator: FilterCreator = ({ config, client }) => ({
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [invalidTicketFormChanges, leftoverChanges] = _.partition(
      changes,
      invalidTicketFormChange,
    )

    const fixedTicketFormChanges = invalidTicketFormChanges.map(change => {
      if (isAdditionChange(change)) {
        return toChange({ after: returnValidInstance(getChangeData(change)) })
      }
      if (isModificationChange(change)) {
        const { before } = change.data
        const { after } = change.data
        return toChange({ before: returnValidInstance(before), after: returnValidInstance(after) })
      }
      return change
    })

    const tempDeployResult = await deployChanges(
      fixedTicketFormChanges,
      async change => {
        await deployChange(change, client, config.apiDefinitions)
      }
    )
    const deployedChangesElemId = tempDeployResult.appliedChanges
      .map(change => getChangeData(change).elemID.getFullName())

    const deployResult: DeployResult = {
      appliedChanges: invalidTicketFormChanges
        .filter(change => deployedChangesElemId.includes(getChangeData(change).elemID.getFullName())),
      errors: tempDeployResult.errors,
    }
    return { deployResult, leftoverChanges }
  },
})
export default filterCreator
