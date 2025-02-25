/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Change,
  DeployResult,
  Element,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceElement,
  isModificationChange,
  ModificationChange,
  ReferenceExpression,
  toChange,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import _, { remove } from 'lodash'
import { logger } from '@salto-io/logging'
import { inspectValue } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { FETCH_CONFIG } from '../config'
import { FilterCreator } from '../filter'
import { deployChange, deployChanges } from '../deployment'
import { TICKET_FIELD_TYPE_NAME, TICKET_FORM_TYPE_NAME, TICKET_STATUS_CUSTOM_STATUS_TYPE_NAME } from '../constants'

const { awu } = collections.asynciterable
const log = logger(module)

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
  clonedInst.value.end_user_conditions ??= []
  clonedInst.value.agent_conditions ??= []
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
const filterCreator: FilterCreator = ({ config, oldApiDefinitions, client, elementSource, definitions }) => ({
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

    const tempDeployResult = await deployChanges(ticketFormChanges, async change => {
      if (isModificationChange(change)) {
        const newAfter = getChangeWithoutRemovedFields(change)
        const intermediateChange =
          newAfter !== undefined ? toChange({ before: change.data.before, after: newAfter }) : undefined
        if (intermediateChange !== undefined) {
          // first deploy is without the removed fields
          await deployChange({ change: intermediateChange, client, apiDefinitions: oldApiDefinitions, definitions })
        }
      }
      await deployChange({ change, client, apiDefinitions: oldApiDefinitions, definitions })
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

    const ticketFields = await awu(await elementSource.list())
      .filter(id => id.typeName === TICKET_FIELD_TYPE_NAME)
      .map(id => elementSource.get(id))
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
          const form = await elementSource.get(id)
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
