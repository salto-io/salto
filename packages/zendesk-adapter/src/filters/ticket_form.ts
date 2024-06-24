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
  DeployResult,
  ElemID,
  Element,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceChange,
  isInstanceElement,
  isModificationChange,
  ModificationChange,
  ReadOnlyElementsSource,
  ReferenceExpression,
  toChange,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import _, { remove } from 'lodash'
import { logger } from '@salto-io/logging'
import { applyFunctionToChangeData, inspectValue } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { FETCH_CONFIG } from '../config'
import { FilterCreator } from '../filter'
import { deployChange, deployChanges } from '../deployment'
import {
  ACCOUNT_FEATURES_TYPE_NAME,
  TICKET_FIELD_TYPE_NAME,
  TICKET_FORM_TYPE_NAME,
  TICKET_STATUS_CUSTOM_STATUS_TYPE_NAME,
  ZENDESK,
} from '../constants'

const { awu } = collections.asynciterable
const SOME_STATUSES = 'SOME_STATUSES'
const log = logger(module)

type Child = {
  // eslint-disable-next-line camelcase
  required_on_statuses: {
    type: string
    statuses?: string[] // question mark to ba able to delete it later on
    // eslint-disable-next-line camelcase
    custom_statuses: number[]
  }
}

type InvalidTicketForm = {
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
    new ElemID(ZENDESK, ACCOUNT_FEATURES_TYPE_NAME, 'instance', ElemID.CONFIG_NAME),
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
  hasCustomStatusesEnabled: boolean,
): instanceValue is InvalidTicketForm =>
  hasCustomStatusesEnabled &&
  _.isArray(instanceValue.agent_conditions) &&
  instanceValue.agent_conditions.some(
    condition =>
      _.isArray(condition.child_fields) &&
      condition.child_fields.some(
        (child: Child) =>
          _.isObject(child.required_on_statuses) &&
          child.required_on_statuses.type === SOME_STATUSES &&
          child.required_on_statuses.custom_statuses !== undefined &&
          !_.isEmpty(child.required_on_statuses.custom_statuses),
      ),
  )

const invalidTicketFormChange = (change: Change<InstanceElement>, hasCustomStatusesEnabled: boolean): boolean =>
  isAdditionOrModificationChange(change) &&
  isInstanceChange(change) &&
  isInvalidTicketForm(getChangeData(change).value, hasCustomStatusesEnabled)

const returnValidInstance = (inst: InstanceElement): InstanceElement => {
  const clonedInst = inst.clone()
  // it is true because if we get to returnValidInstance function its after we got true from isInvalidTicketForm so
  // custom_statuses is enabled
  if (isInvalidTicketForm(clonedInst.value, true)) {
    clonedInst.value.agent_conditions.forEach(condition =>
      condition.child_fields.forEach(child => {
        if (
          child.required_on_statuses.type === SOME_STATUSES &&
          child.required_on_statuses.custom_statuses !== undefined &&
          !_.isEmpty(child.required_on_statuses.custom_statuses)
        ) {
          delete child.required_on_statuses.statuses
        }
      }),
    )
  }
  return clonedInst
}

// this function returns an instance that contains the removed field. This is because zendesk does not allow removing
// field and condition at the same time
const getChangeWithoutRemovedFields = (change: ModificationChange<InstanceElement>): InstanceElement | undefined => {
  const { before } = change.data
  const { after } = change.data
  const beforeFields: (number | string | ReferenceExpression)[] = before.value.ticket_field_ids ?? []
  const afterFields = new Set(after.value.ticket_field_ids ?? [])
  const removedFields = beforeFields.filter(field => !afterFields.has(field))
  // filtering out anything that is a reference since we can have a missing reference in the before that could have
  // been removed in the after and we don't want it to be added to the list again
  const [finalRemovedFields, referenceFields] = _.partition(
    removedFields,
    field => _.isString(field) || _.isNumber(field),
  )
  if (!_.isEmpty(referenceFields)) {
    log.debug(
      `there are fields which are not a string or a number in the before and not in the after of the change in form: ${before.elemID.getFullName()}`,
    )
    log.trace(`the form ${before.elemID.getFullName()} before: ${inspectValue(before)}`)
  }
  if (_.isEmpty(finalRemovedFields)) {
    return undefined
  }
  const clonedInst = after.clone()
  clonedInst.value.ticket_field_ids = (clonedInst.value.ticket_field_ids ?? []).concat(finalRemovedFields)
  return clonedInst
}

const removeCustomTicketStatusFromTicketFieldIDsField = (
  instance: InstanceElement,
  customTicketElement: InstanceElement,
): void => {
  const ticketFieldIDs: Array<number | ReferenceExpression> = instance.value.ticket_field_ids || []
  if (ticketFieldIDs.includes(customTicketElement.value.id)) {
    // found the ID of the custom ticket
    ticketFieldIDs.splice(ticketFieldIDs.indexOf(customTicketElement.value.id), 1)
    return
  }

  const foundCustomTicketField = ticketFieldIDs.find(id =>
    isReferenceExpression(id) ? id.elemID.isEqual(customTicketElement.elemID) : false,
  )
  if (foundCustomTicketField !== undefined) {
    // found a ReferenceExpression pointing to the custom ticket
    ticketFieldIDs.splice(ticketFieldIDs.indexOf(foundCustomTicketField), 1)
  }
}

/**
 * this filter deploys ticket_form changes. if the instance has both statuses and custom_statuses under
 * required_on_statuses then it removes the statuses field.
 */
const filterCreator: FilterCreator = ({ config, client, elementsSource }) => ({
  name: 'ticketFormDeploy',
  onFetch: async (elements: Element[]): Promise<void> => {
    if (config[FETCH_CONFIG].omitTicketStatusTicketField !== true) {
      return
    }
    const genericCustomTicketElement = elements
      .filter(isInstanceElement)
      .find(instance => instance.value.type === TICKET_STATUS_CUSTOM_STATUS_TYPE_NAME)
    if (genericCustomTicketElement === undefined) {
      return
    }

    elements
      .filter(isInstanceElement)
      .filter(element => element.elemID.typeName === TICKET_FORM_TYPE_NAME)
      .map(instance => removeCustomTicketStatusFromTicketFieldIDsField(instance, genericCustomTicketElement))

    remove(
      elements,
      element => genericCustomTicketElement.elemID && element.elemID.isEqual(genericCustomTicketElement.elemID),
    )
  },
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [ticketFormChanges, leftoverChanges] = _.partition(
      changes,
      change => TICKET_FORM_TYPE_NAME === getChangeData(change).elemID.typeName,
    )
    if (ticketFormChanges.length === 0) {
      return {
        leftoverChanges: changes,
        deployResult: {
          errors: [],
          appliedChanges: [],
        },
      }
    }
    const hasCustomStatusesEnabled = await isCustomStatusesEnabled(elementsSource)

    const [invalidModificationAndAdditionChanges, otherTicketFormChanges] = _.partition(ticketFormChanges, change =>
      invalidTicketFormChange(change, hasCustomStatusesEnabled),
    )

    const fixedTicketFormChanges = await awu(invalidModificationAndAdditionChanges)
      .map(change => applyFunctionToChangeData(change, returnValidInstance))
      .toArray()

    const allChanges = fixedTicketFormChanges.concat(otherTicketFormChanges)

    const tempDeployResult = await deployChanges(allChanges, async change => {
      if (isModificationChange(change)) {
        const newAfter = getChangeWithoutRemovedFields(change)
        const intermediateChange =
          newAfter !== undefined ? toChange({ before: change.data.before, after: newAfter }) : undefined
        if (intermediateChange !== undefined) {
          // first deploy is without the removed fields
          await deployChange(intermediateChange, client, config.apiDefinitions)
        }
      }
      await deployChange(change, client, config.apiDefinitions)
    })
    const deployedChangesElemId = new Set(
      tempDeployResult.appliedChanges.map(change => getChangeData(change).elemID.getFullName()),
    )

    const deployResult: DeployResult = {
      appliedChanges: ticketFormChanges.filter(change =>
        deployedChangesElemId.has(getChangeData(change).elemID.getFullName()),
      ),
      errors: tempDeployResult.errors,
    }
    return { deployResult, leftoverChanges }
  },
  // this onDeploy filter should be temporary and deleted once SALTO-4726 is implemented. This is because when
  // custom_status ticket_field does not exist in the env and is referenced by a form, it is removed from the form and
  // the deploy fails due to summarizeDeployChanges. This onDeploy filter restores ticket_field_ids to its initial state
  onDeploy: async (changes: Change<InstanceElement>[]) => {
    const ticketFormChanges = changes
      .filter(isAdditionOrModificationChange)
      .filter(change => TICKET_FORM_TYPE_NAME === getChangeData(change).elemID.typeName)
    if (_.isEmpty(ticketFormChanges)) {
      return
    }

    const ticketFields = await awu(await elementsSource.list())
      .filter(id => id.typeName === TICKET_FIELD_TYPE_NAME)
      .map(id => elementsSource.get(id))
      .filter(isInstanceElement)
      .toArray()
    const ticketStatusTicketField = ticketFields.find(field => field.value.type === 'custom_status')
    if (ticketStatusTicketField === undefined) {
      log.error('could not find field of type custom_status not running on deploy of ticket_form')
      return
    }

    // ticket status field exists in the account and therefore there is no need for the onDeploy
    if (ticketStatusTicketField.value.id !== undefined) {
      return
    }

    const ticketFormsToFieldIds = Object.fromEntries(
      await awu(ticketFormChanges)
        .map(change => getChangeData(change).elemID)
        .map(async id => {
          const form = await elementsSource.get(id)
          if (!isInstanceElement(form)) {
            return [id.getFullName(), undefined]
          }
          const ticketFieldIds = form.value.ticket_field_ids // the references are unresolved
          return [id.getFullName(), ticketFieldIds]
        })
        .toArray(),
    )

    ticketFormChanges.forEach(change => {
      const form = getChangeData(change)
      const ticketFieldIds = ticketFormsToFieldIds[form.elemID.getFullName()]
      if (ticketFieldIds === undefined) {
        log.error(`could not find ticketFieldIds for form ${form.elemID.name}`)
        return
      }
      form.value.ticket_field_ids = ticketFieldIds
    })
  },
})
export default filterCreator
