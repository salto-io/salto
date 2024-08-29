/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  AdditionChange,
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
  ReadOnlyElementsSource,
  RemovalChange,
} from '@salto-io/adapter-api'
import { getInstancesFromElementSource, getParent, getParentElemID } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { JiraConfig } from '../../config/config'
import { getOrderNameFromOption } from '../../common/fields'
import { FIELD_CONTEXT_OPTION_TYPE_NAME, OPTIONS_ORDER_TYPE_NAME } from '../../filters/fields/constants'

const log = logger(module)

const getNotInOrderError = (option: InstanceElement): ChangeError => ({
  elemID: option.elemID,
  severity: 'Error',
  message: "This option is not being referenced by it's corresponding order",
  detailedMessage: `The order instance ${getOrderNameFromOption(option)} should reference all it's options`,
})

const getOrderNotExistsError = (option: InstanceElement): ChangeError => ({
  elemID: option.elemID,
  severity: 'Error',
  message: "There is no order instance for this option's scope",
  detailedMessage: "There should be an order instance related to this option's parent",
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
  deletedOptionsNotInRemovalChanges: string[],
): ChangeError => ({
  elemID: orderChange.data.after.elemID,
  severity: 'Error',
  message: "This order is not referencing all it's options",
  detailedMessage:
    deletedOptionsNotInRemovalChanges.length === 1
      ? `The option ${deletedOptionsNotInRemovalChanges[0]} was deleted from the order but was not removed`
      : `The options ${deletedOptionsNotInRemovalChanges.join(',')} were deleted from the order but were not removed`,
})

const getDeletedOptionsNotInRemovalChanges = (
  orderChange: ModificationChange<InstanceElement>,
  removedOptionsByParent: Record<string, InstanceElement[]>,
): string[] => {
  const deletedOptionsFromOrder = getDeletedOptionsFromOrderModificationChange(orderChange)
  const removedOptions = new Set<string>(
    (removedOptionsByParent[getParent(orderChange.data.after).elemID.getFullName()] ?? []).map(instance =>
      instance.elemID.getFullName(),
    ),
  )
  return deletedOptionsFromOrder.filter(option => !removedOptions.has(option))
}

const getChangedAndUnchangedOrdersByParent = async (
  orderChanges: (AdditionChange<InstanceElement> | ModificationChange<InstanceElement>)[],
  addedOptionsByParent: Record<string, InstanceElement[]>,
  elementsSource: ReadOnlyElementsSource | undefined,
): Promise<{
  changedOrdersByParent: Record<string, InstanceElement>
  unchangedOrdersByParent: Record<string, InstanceElement>
}> => {
  const changedOrdersByParent = _.keyBy(orderChanges.map(getChangeData), instance =>
    getParentElemID(instance).getFullName(),
  )

  const parentsWithoutChangedOrder = new Set<string>(
    Object.keys(addedOptionsByParent).filter(parent => changedOrdersByParent[parent] === undefined),
  )
  if (parentsWithoutChangedOrder.size > 0 && elementsSource === undefined) {
    log.warn('fieldContextOptions validator not fully ran due to missing elementsSource')
  }
  const unchangedOrdersByParent =
    parentsWithoutChangedOrder.size > 0 && elementsSource !== undefined
      ? _.keyBy(
          (await getInstancesFromElementSource(elementsSource, [OPTIONS_ORDER_TYPE_NAME])).filter(order =>
            parentsWithoutChangedOrder.has(getParentElemID(order).getFullName()),
          ),
          instance => getParentElemID(instance).getFullName(),
        )
      : {}
  return { changedOrdersByParent, unchangedOrdersByParent }
}

const getOptionErrors = async (
  orderChanges: (AdditionChange<InstanceElement> | ModificationChange<InstanceElement>)[],
  additionOptionChanges: AdditionChange<InstanceElement>[],
  elementsSource: ReadOnlyElementsSource | undefined,
): Promise<ChangeError[]> => {
  const addedOptionsByParent = _.groupBy(additionOptionChanges.map(getChangeData), instance =>
    getParentElemID(instance).getFullName(),
  )

  const { changedOrdersByParent, unchangedOrdersByParent } = await getChangedAndUnchangedOrdersByParent(
    orderChanges,
    addedOptionsByParent,
    elementsSource,
  )
  // We group the added options by their parent and check they are referenced by the corresponding order
  const addedOptionsErrors = _.flatMap(addedOptionsByParent, (options, parentFullName) => {
    const changedOrder = changedOrdersByParent[parentFullName]
    if (changedOrder === undefined) {
      const unchangedOrder = unchangedOrdersByParent[parentFullName]
      return unchangedOrder === undefined ? options.map(getOrderNotExistsError) : options.map(getNotInOrderError)
    }
    const orderOptionsSet = new Set<string>(
      collections.array
        .makeArray(changedOrder.value.options)
        .filter(isReferenceExpression)
        .map(option => option.elemID.getFullName()),
    )
    return options.filter(option => !orderOptionsSet.has(option.elemID.getFullName())).map(getNotInOrderError)
  })
  return addedOptionsErrors
}

const getOrderErrors = (
  orderChanges: (AdditionChange<InstanceElement> | ModificationChange<InstanceElement>)[],
  removalOptionChanges: RemovalChange<InstanceElement>[],
): ChangeError[] => {
  const removedOptionsByParent = _.groupBy(removalOptionChanges.map(getChangeData), instance =>
    getParentElemID(instance).getFullName(),
  )
  return orderChanges
    .filter(isModificationChange)
    .map(orderChange => ({
      orderChange,
      deletedOptionsNotInRemovalChanges: getDeletedOptionsNotInRemovalChanges(orderChange, removedOptionsByParent),
    }))
    .filter(({ deletedOptionsNotInRemovalChanges }) => deletedOptionsNotInRemovalChanges.length > 0)
    .map(({ orderChange, deletedOptionsNotInRemovalChanges }) =>
      getOrderError(orderChange, deletedOptionsNotInRemovalChanges),
    )
}

/**
 * Verify that the orders reference all the added options, and that all options removed from orders are removed
 */
export const fieldContextOptionsValidator: (config: JiraConfig) => ChangeValidator =
  config => async (changes, elementsSource) => {
    if (!config.fetch.splitFieldContextOptions) {
      return []
    }
    const orderChanges = changes
      .filter(isAdditionOrModificationChange)
      .filter(isInstanceChange)
      .filter(change => getChangeData(change).elemID.typeName === OPTIONS_ORDER_TYPE_NAME)

    const optionChanges = changes
      .filter(isAdditionOrRemovalChange)
      .filter(isInstanceChange)
      .filter(change => getChangeData(change).elemID.typeName === FIELD_CONTEXT_OPTION_TYPE_NAME)

    return [
      ...(await getOptionErrors(orderChanges, optionChanges.filter(isAdditionChange), elementsSource)),
      ...getOrderErrors(orderChanges, optionChanges.filter(isRemovalChange)),
    ]
  }
