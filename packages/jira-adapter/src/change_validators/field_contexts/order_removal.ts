/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ChangeValidator, getChangeData, isInstanceChange, isRemovalChange } from '@salto-io/adapter-api'
import { getParentElemID } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { JiraConfig } from '../../config/config'
import {
  FIELD_CONTEXT_OPTION_TYPE_NAME,
  FIELD_CONTEXT_TYPE_NAME,
  OPTIONS_ORDER_TYPE_NAME,
} from '../../filters/fields/constants'

const log = logger(module)
/**
 * Verify that orders are removed with their parent
 */
export const fieldContextOrderRemovalValidator: (config: JiraConfig) => ChangeValidator = config => async changes => {
  if (!config.fetch.splitFieldContextOptions) {
    return []
  }
  const removedInstances = changes.filter(isRemovalChange).filter(isInstanceChange).map(getChangeData)
  const removedOptionsAndContexts = new Set(
    removedInstances
      .filter(
        instance =>
          instance.elemID.typeName === FIELD_CONTEXT_OPTION_TYPE_NAME ||
          instance.elemID.typeName === FIELD_CONTEXT_TYPE_NAME,
      )
      .map(instance => instance.elemID.getFullName()),
  )
  const removedOrders = removedInstances.filter(instance => instance.elemID.typeName === OPTIONS_ORDER_TYPE_NAME)
  const bla = removedOrders.filter(order => !removedOptionsAndContexts.has(getParentElemID(order).getFullName()))
  const parentName = getParentElemID(removedOrders[0]).getFullName()
  log.error(`bla: ${bla.length}, parentName: ${parentName}`)
  return removedOrders
    .filter(order => !removedOptionsAndContexts.has(getParentElemID(order).getFullName()))
    .map(order => ({
      elemID: order.elemID,
      severity: 'Error',
      message: "This order was removed while it's parent wasn't",
      detailedMessage: "Order should be removed with it's parent",
    }))
}
