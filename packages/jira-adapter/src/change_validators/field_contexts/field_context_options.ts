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
  InstanceElement,
  isAdditionChange,
  isAdditionOrModificationChange,
  isAdditionOrRemovalChange,
  isInstanceChange,
  isModificationChange,
  isReferenceExpression,
  isRemovalChange,
  ModificationChange,
} from '@salto-io/adapter-api'
import { getParent } from '@salto-io/adapter-utils'
import { collections, values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { JiraConfig } from '../../config/config'
import { getOrderNameFromOption } from '../../common/fields'
import { FIELD_CONTEXT_OPTION_TYPE_NAME, OPTIONS_ORDER_TYPE_NAME } from '../../filters/fields/constants'

const getNotInOrderError = (option: InstanceElement): ChangeError => ({
  elemID: option.elemID,
  severity: 'Error',
  message: "This option is not being referenced by it's corresponding order",
  detailedMessage: `The order instance ${getOrderNameFromOption(option)} should reference all it's options`,
})

const getDeletedOptionsFromOrderModificationChange = (change: ModificationChange<InstanceElement>): string[] => {
  const { before, after } = change.data
  const beforeOptions = collections.array
    .makeArray(before.value.options)
    .filter(isReferenceExpression)
    .map(option => option.elemID.getFullName())
  const afterOptions = new Set<string>(
    collections.array
      .makeArray(after.value.options)
      .filter(isReferenceExpression)
      .map(option => option.elemID.getFullName()),
  )
  return beforeOptions.filter(option => !afterOptions.has(option))
}

const getOrderError = (
  orderChange: ModificationChange<InstanceElement>,
  removedOptionsByParent: Record<string, InstanceElement[]>,
): ChangeError | undefined => {
  const deletedOptionsFromOrder = getDeletedOptionsFromOrderModificationChange(orderChange)
  const removedOptions = new Set<string>(
    (removedOptionsByParent[getParent(orderChange.data.after).elemID.getFullName()] ?? []).map(instance =>
      instance.elemID.getFullName(),
    ),
  )
  const deletedOptionsFromOrderNotInRemoved = deletedOptionsFromOrder.filter(option => !removedOptions.has(option))
  if (deletedOptionsFromOrderNotInRemoved.length === 0) {
    return undefined
  }
  const detailedMessage =
    deletedOptionsFromOrderNotInRemoved.length === 1
      ? `The option ${deletedOptionsFromOrderNotInRemoved[0]} was deleted from the order but was not removed`
      : `The options ${deletedOptionsFromOrderNotInRemoved.join(',')} were deleted from the order but were not removed`
  return {
    elemID: orderChange.data.after.elemID,
    severity: 'Error',
    message: "This order is not referencing all it's options",
    detailedMessage,
  }
}

/**
 * Verify that the context reference all the added/modified options.
 */
export const fieldContextOptionsValidator: (config: JiraConfig) => ChangeValidator = config => async changes => {
  if (!config.fetch.splitFieldContextOptions) {
    return []
  }
  const orderChanges = changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .filter(change => getChangeData(change).elemID.typeName === OPTIONS_ORDER_TYPE_NAME)

  const orderByParent = _.keyBy(orderChanges.map(getChangeData), instance => getParent(instance).elemID.getFullName())

  const optionChanges = changes
    .filter(isAdditionOrRemovalChange)
    .filter(isInstanceChange)
    .filter(change => getChangeData(change).elemID.typeName === FIELD_CONTEXT_OPTION_TYPE_NAME)

  const addedOptionsByParent = _.groupBy(optionChanges.filter(isAdditionChange).map(getChangeData), instance =>
    getParent(instance).elemID.getFullName(),
  )
  const addedOptionsErrors = _.flatMap(addedOptionsByParent, (options, parentFullName) => {
    const order = orderByParent[parentFullName]
    if (order === undefined) {
      return options.map(getNotInOrderError)
    }
    const orderOptionsHash = _.keyBy(order.value.options, option => option.elemID.getFullName())
    return options.filter(option => orderOptionsHash[option.elemID.getFullName()] === undefined).map(getNotInOrderError)
  })

  const removedOptionsByParent = _.groupBy(optionChanges.filter(isRemovalChange).map(getChangeData), instance =>
    getParent(instance).elemID.getFullName(),
  )

  const orderErrors = orderChanges
    .filter(isModificationChange)
    .map(orderChange => getOrderError(orderChange, removedOptionsByParent))
    .filter(values.isDefined)
  return [...addedOptionsErrors, ...orderErrors]
}
