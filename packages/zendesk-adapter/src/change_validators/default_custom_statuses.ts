/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ChangeError,
  ChangeValidator,
  getChangeData,
  isInstanceChange,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections, values as lowerdashValues } from '@salto-io/lowerdash'
import { DEFAULT_CUSTOM_STATUSES_TYPE_NAME, HOLD_CATEGORY } from '../constants'

const { awu } = collections.asynciterable
const log = logger(module)
const { isDefined } = lowerdashValues

/**
 * this change validator checks that all default custom statuses are active and are default of the correct category
 */
export const defaultCustomStatusesValidator: ChangeValidator = async (changes, elementSource) => {
  if (elementSource === undefined) {
    log.error('Failed to run defaultCustomStatusesValidator because no element source was provided')
    return []
  }

  const defaultInstance = changes
    .filter(isInstanceChange)
    .filter(change => getChangeData(change).elemID.typeName === DEFAULT_CUSTOM_STATUSES_TYPE_NAME)
    .map(getChangeData)
    .find(inst => inst.elemID.typeName === DEFAULT_CUSTOM_STATUSES_TYPE_NAME) // as there is only one instance
  if (defaultInstance === undefined) {
    return []
  }
  const inactiveStatusesErrors: ChangeError[] = await awu(Object.keys(defaultInstance.value))
    .map(async key => {
      if (isReferenceExpression(defaultInstance.value[key])) {
        const statusInstance = await elementSource.get(defaultInstance.value[key].elemID)
        if (statusInstance === undefined) {
          log.error(`could not find status ${defaultInstance.value[key].elemID.getFullName()}`)
          return undefined
        }
        return statusInstance.value.active !== true && statusInstance.value.status_category !== HOLD_CATEGORY
          ? statusInstance
          : undefined
      }
      return undefined // if it is not a reference expression
    })
    .filter(isDefined)
    .map(
      (instance): ChangeError => ({
        elemID: defaultInstance.elemID,
        severity: 'Error',
        message: 'Default custom statuses must be active.',
        detailedMessage: `Please set the default custom status ${instance.elemID.name} as active or choose a different default custom status`,
      }),
    )
    .toArray()

  const mismatchedStatusesErrors: ChangeError[] = await awu(Object.keys(defaultInstance.value))
    .map(async key => {
      if (isReferenceExpression(defaultInstance.value[key])) {
        const statusInstance = await elementSource.get(defaultInstance.value[key].elemID)
        if (statusInstance === undefined) {
          log.error(`could not find status ${defaultInstance.value[key].elemID.getFullName()}`)
          return undefined
        }
        return statusInstance.value.status_category !== key ? { instance: statusInstance, category: key } : undefined
      }
      return undefined // if it is not a reference expression
    })
    .filter(isDefined)
    .map(
      ({ instance, category }): ChangeError => ({
        elemID: defaultInstance.elemID,
        severity: 'Error',
        message: 'Default custom status category mismatch',
        detailedMessage: `The category of the default custom status ${instance.elemID.name} must be ${category}.`,
      }),
    )
    .toArray()

  return inactiveStatusesErrors.concat(mismatchedStatusesErrors)
}
