/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ChangeValidator, ElemID, getChangeData, isInstanceChange, isReferenceExpression } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { CUSTOM_STATUS_TYPE_NAME, DEFAULT_CUSTOM_STATUSES_TYPE_NAME, HOLD_CATEGORY, ZENDESK } from '../constants'

const log = logger(module)

/**
 * this change validator checks that a status that is default is not changed to inactive
 */
export const customStatusActiveDefaultValidator: ChangeValidator = async (changes, elementSource) => {
  const customStatusChanges = changes
    .filter(change => getChangeData(change).elemID.typeName === CUSTOM_STATUS_TYPE_NAME)
    .filter(isInstanceChange)
  if (_.isEmpty(customStatusChanges)) {
    return []
  }

  if (elementSource === undefined) {
    log.error('Failed to run customStatusActiveDefaultValidator because no element source was provided')
    return []
  }

  const defaultCustomStatuses = await elementSource.get(
    new ElemID(ZENDESK, DEFAULT_CUSTOM_STATUSES_TYPE_NAME, 'instance', ElemID.CONFIG_NAME),
  )

  if (defaultCustomStatuses === undefined) {
    log.error('Failed to find default custom statuses in the elementSource')
    return []
  }

  const defaultNames: string[] = Object.keys(defaultCustomStatuses.value)
    .map(key =>
      isReferenceExpression(defaultCustomStatuses.value[key])
        ? defaultCustomStatuses.value[key].elemID.name
        : undefined,
    )
    .filter(name => name !== undefined)

  return customStatusChanges
    .map(getChangeData)
    .filter(
      status =>
        !status.value.active &&
        defaultNames.includes(status.elemID.name) &&
        status.value.status_category !== HOLD_CATEGORY,
    )
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Error',
      message: 'Default custom statuses must be active.',
      detailedMessage: `Please set the default custom status ${instance.elemID.name} as active or choose a different default custom status`,
    }))
}
