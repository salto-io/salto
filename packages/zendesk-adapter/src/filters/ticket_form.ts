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
  Change, DeployResult, ElemID,
  getChangeData,
  InstanceElement, isAdditionOrModificationChange, isInstanceChange, isInstanceElement, ReadOnlyElementsSource,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { applyFunctionToChangeData } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { FilterCreator } from '../filter'
import { deployChange, deployChanges } from '../deployment'
import {
  ACCOUNT_FEATURES_TYPE_NAME,
  TICKET_FORM_TYPE_NAME,
  ZENDESK,
} from '../constants'

const { awu } = collections.asynciterable
const SOME_STATUSES = 'SOME_STATUSES'
const log = logger(module)


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

const isCustomStatusesEnabled = async (elementSource?: ReadOnlyElementsSource): Promise<boolean> => {
  if (elementSource === undefined) {
    log.error('Returning that customStatuses is disabled since no element source was provided')
    return false
  }

  const accountFeatures = await elementSource.get(
    new ElemID(
      ZENDESK,
      ACCOUNT_FEATURES_TYPE_NAME,
      'instance',
      ElemID.CONFIG_NAME
    )
  )

  if (!isInstanceElement(accountFeatures)) {
    log.warn('Returning that customStatuses is disabled since accountFeatures is not an instance')
    return false
  }
  const customStatusesEnabled = accountFeatures.value.custom_statuses_enabled
  if (customStatusesEnabled === undefined) {
    log.warn('Returning that customStatuses is disabled since custom_statuses_enabled does not exist')
    return false
  }
  return customStatusesEnabled.enabled
}

/**
 * checks if both statuses and custom_statuses are defined and if custom_statuses is enabled
 */
const isInvalidTicketForm = (
  instanceValue: Record<string, unknown>,
  hasCustomStatusesEnabled: boolean
): instanceValue is TicketForm =>
  hasCustomStatusesEnabled
  && _.isArray(instanceValue.agent_conditions)
    && instanceValue.agent_conditions.some(condition =>
      _.isArray(condition.child_fields)
      && condition.child_fields.some((child: Child) =>
        _.isObject(child.required_on_statuses)
        && child.required_on_statuses.type === SOME_STATUSES
        && (child.required_on_statuses.custom_statuses !== undefined
          && !_.isEmpty(child.required_on_statuses.custom_statuses))))


const invalidTicketFormChange = (change: Change<InstanceElement>, hasCustomStatusesEnabled: boolean): boolean =>
  isAdditionOrModificationChange(change)
  && isInstanceChange(change)
  && isInvalidTicketForm(getChangeData(change).value, hasCustomStatusesEnabled)

const returnValidInstance = (inst: InstanceElement): InstanceElement => {
  const clonedInst = inst.clone()
  // it is true because if we get to returnValidInstance function its after we got true from isInvalidTicketForm so
  // custom_statuses is enabled
  if (isInvalidTicketForm(clonedInst.value, true)) {
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
const filterCreator: FilterCreator = ({ config, client, elementsSource }) => ({
  name: 'ticketFormDeploy',
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [TicketFormChanges, leftoverChanges] = _.partition(
      changes,
      change => TICKET_FORM_TYPE_NAME === getChangeData(change).elemID.typeName,
    )
    const hasCustomStatusesEnabled = await isCustomStatusesEnabled(elementsSource)

    const [invalidModificationAndAdditionChanges, otherTicketFormChanges] = _.partition(
      TicketFormChanges,
      change => invalidTicketFormChange(change, hasCustomStatusesEnabled),
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
