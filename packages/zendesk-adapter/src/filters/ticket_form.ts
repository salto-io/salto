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
  Change, DeployResult,
  getChangeData,
  InstanceElement, isAdditionOrModificationChange, isInstanceChange,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { applyFunctionToChangeData } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { FilterCreator } from '../filter'
import { deployChange, deployChanges } from '../deployment'
import { TICKET_FORM_TYPE_NAME } from '../constants'

const { awu } = collections.asynciterable
const SOME_STATUSES = 'SOME_STATUSES'


type Child = {
  // eslint-disable-next-line camelcase
  required_on_statuses: {
    type: string
    statuses?: string[]
    // eslint-disable-next-line camelcase
    custom_statuses: number[]
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
        && (child.required_on_statuses.custom_statuses !== undefined
        && !_.isEmpty(child.required_on_statuses.custom_statuses))))

const invalidTicketFormChange = (change: Change<InstanceElement>): boolean =>
  isAdditionOrModificationChange(change)
  && isInstanceChange(change)
  && isInvalidTicketForm(getChangeData(change).value)

const returnValidInstance = (inst: InstanceElement): InstanceElement => {
  const clonedInst = inst.clone()
  if (isInvalidTicketForm(clonedInst.value)) {
    clonedInst.value.agent_conditions
      .forEach(condition => condition.child_fields
        .forEach(child => {
          if (child.required_on_statuses.type === SOME_STATUSES
            && (child.required_on_statuses.custom_statuses !== undefined
              && !_.isEmpty(child.required_on_statuses.custom_statuses))) {
            delete child.required_on_statuses.statuses
          }
        }))
  }
  return clonedInst
}

/**
 * this filter deploys ticket_form changes. if the instance has both statuses and custom_statuses under
 * required_on_statuses then it removes the statuses field.
 */
const filterCreator: FilterCreator = ({ config, client }) => ({
  name: 'ticketFormDeploy',
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [TicketFormChanges, leftoverChanges] = _.partition(
      changes,
      change => TICKET_FORM_TYPE_NAME === getChangeData(change).elemID.typeName,
    )
    const [invalidModificationAndAdditionChanges, otherTicketFormChanges] = _.partition(
      TicketFormChanges,
      invalidTicketFormChange,
    )

    const fixedTicketFormChanges = await awu(invalidModificationAndAdditionChanges)
      .map(change => applyFunctionToChangeData(change, returnValidInstance))
      .toArray()

    const tempDeployResult = await deployChanges(
      [...fixedTicketFormChanges, ...otherTicketFormChanges],
      async change => {
        await deployChange(change, client, config.apiDefinitions)
      }
    )
    const deployedChangesElemId = new Set(tempDeployResult.appliedChanges
      .map(change => getChangeData(change).elemID.getFullName()))

    const deployResult: DeployResult = {
      appliedChanges: TicketFormChanges
        .filter(change => deployedChangesElemId.has(getChangeData(change).elemID.getFullName())),
      errors: tempDeployResult.errors,
    }
    return { deployResult, leftoverChanges }
  },
})
export default filterCreator
