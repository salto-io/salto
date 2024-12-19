/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ChangeError, ElemID, InstanceElement, isInstanceElement, ReadOnlyElementsSource } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { ACCOUNT_FEATURES_TYPE_NAME, ZENDESK } from '../constants'
import { FixElementsHandler } from './types'

const log = logger(module)
const SOME_STATUSES = 'SOME_STATUSES'

type Child = {
  required_on_statuses: {
    type: string
    statuses?: string[] // question mark to ba able to delete it later on
    custom_statuses: number[]
  }
}

type InvalidTicketForm = {
  agent_conditions: {
    child_fields: Child[]
  }[]
}

type InvalidTicketFormInstance = InstanceElement & {
  value: InvalidTicketForm
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

const invalidChild = (child: Child): boolean =>
  _.isObject(child.required_on_statuses) &&
  child.required_on_statuses.type === SOME_STATUSES &&
  child.required_on_statuses.custom_statuses !== undefined &&
  !_.isEmpty(child.required_on_statuses.custom_statuses) &&
  child.required_on_statuses.statuses !== undefined

const isInvalidTicketForm = (instance: InstanceElement): instance is InvalidTicketFormInstance =>
  _.isArray(instance.value.agent_conditions) &&
  instance.value.agent_conditions.some(
    condition => _.isArray(condition.child_fields) && condition.child_fields.some(invalidChild),
  )

const returnValidInstance = (inst: InstanceElement): InstanceElement => {
  const clonedInst = inst.clone()
  // it is true because if we get to returnValidInstance function its after we got true from isInvalidTicketForm so
  // custom_statuses is enabled
  if (isInvalidTicketForm(clonedInst)) {
    clonedInst.value.agent_conditions.forEach(condition =>
      condition.child_fields.forEach(child => {
        if (invalidChild(child)) {
          delete child.required_on_statuses.statuses
        }
      }),
    )
  }
  return clonedInst
}

const toError = (element: InstanceElement): ChangeError => ({
  elemID: element.elemID,
  severity: 'Info',
  message: 'Ticket forms fixed',
  detailedMessage:
    'Ticket forms condition fixed as zendesk api does not allow conditions to include both `custom_statuses` and `statuses` fields.',
})

/**
 * zendesk does not allow deploying forms with conditions that have both `custom_statuses` field
 * and `statuses` field. therefore, if the env has Custom Statuses enabled we will fix the form
 * conditions to not include the `statuses` field.
 */
export const fixTicketFormsHandler: FixElementsHandler =
  ({ elementsSource }) =>
  async elements => {
    const hasCustomStatusesEnabled = await isCustomStatusesEnabled(elementsSource)
    if (!hasCustomStatusesEnabled) {
      return {
        fixedElements: [],
        errors: [],
      }
    }

    const fixedTicketForms = elements.filter(isInstanceElement).filter(isInvalidTicketForm).map(returnValidInstance)
    const errors = fixedTicketForms.map(toError)

    return {
      fixedElements: fixedTicketForms,
      errors,
    }
  }
