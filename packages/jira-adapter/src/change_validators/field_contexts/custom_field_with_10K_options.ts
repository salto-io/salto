/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  AdditionChange,
  ChangeError,
  ChangeValidator,
  InstanceElement,
  ModificationChange,
  getChangeData,
  isAdditionChange,
  isAdditionOrModificationChange,
  isEqualValues,
  isInstanceChange,
  Change,
  ReadOnlyElementsSource,
} from '@salto-io/adapter-api'
import { getInstancesFromElementSource, getParents } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import {
  FIELD_CONTEXT_OPTION_TYPE_NAME,
  FIELD_CONTEXT_TYPE_NAME,
  FIELD_TYPE_NAME,
  OPTIONS_ORDER_TYPE_NAME,
} from '../../filters/fields/constants'
import { getOptionsFromContext } from '../../filters/fields/context_options'
import { JiraConfig } from '../../config/config'
import { getContextParent, getContextParentAsync, getContextPrettyName } from '../../common/fields'

const log = logger(module)
const { awu } = collections.asynciterable

const hasNewOption = (change: ModificationChange<InstanceElement> | AdditionChange<InstanceElement>): boolean => {
  if (isAdditionChange(change)) {
    return true
  }
  const { before, after } = change.data
  const optionsBefore = getOptionsFromContext(before)
  const optionsAfter = getOptionsFromContext(after)
  return !isEqualValues(optionsBefore, optionsAfter)
}

const slowDeploymentError = (context: InstanceElement): ChangeError => ({
  elemID: context.elemID,
  severity: 'Info',
  message: 'Slow deployment due to field context with more than 10K options',
  detailedMessage: `The deployment of ${getContextPrettyName(context)}'s options will be slower because there are more than 10K options.`,
})

const blockDeploymentError = (instance: InstanceElement): ChangeError => {
  const context = instance.elemID.typeName === FIELD_CONTEXT_TYPE_NAME ? instance : getContextParent(instance)
  return {
    elemID: instance.elemID,
    severity: 'Error',
    message: 'Cannot deploy a field context with more than 10K options',
    detailedMessage: `The deployment of ${getContextPrettyName(context)}'s options will be blocked because there are more than 10K options.`,
  }
}

const createContextToOptionsCountRecord = async (
  elementsSource: ReadOnlyElementsSource,
): Promise<Record<string, number>> => {
  const contextToOptionsCount: Record<string, number> = {}
  const orderInstances = await getInstancesFromElementSource(elementsSource, [OPTIONS_ORDER_TYPE_NAME])
  await awu(orderInstances).forEach(async orderInstance => {
    const contextFullName = (await getContextParentAsync(orderInstance, elementsSource)).elemID.getFullName()
    if (!Array.isArray(orderInstance.value.options)) {
      log.warn(`Options order instance ${orderInstance.elemID.getFullName()} options field is not an array`)
      return
    }
    const alreadyCountedOptions = contextToOptionsCount[contextFullName] ?? 0
    contextToOptionsCount[contextFullName] = alreadyCountedOptions + orderInstance.value.options.length
  })
  return contextToOptionsCount
}

const blockDeploymentsOfOrdersAndOptions = (
  contextToOptionsCount: Record<string, number>,
  changedOrders: InstanceElement[],
  changes: readonly Change[],
): ChangeError[] => {
  const orderErrors = changedOrders
    .filter(order => contextToOptionsCount[getContextParent(order).elemID.getFullName()] > 10000)
    .map(blockDeploymentError)
  const optionErrors = changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === FIELD_CONTEXT_OPTION_TYPE_NAME)
    .filter(option => contextToOptionsCount[getContextParent(option).elemID.getFullName()] > 10000)
    .map(blockDeploymentError)
  return [...orderErrors, ...optionErrors]
}

const warnSlowDeploymentOfOrders = (
  contextToOptionsCount: Record<string, number>,
  changedOrders: InstanceElement[],
): ChangeError[] =>
  changedOrders
    .filter(order => contextToOptionsCount[getContextParent(order).elemID.getFullName()] > 10000)
    .map(order => slowDeploymentError(getContextParent(order)))

const check10KOptionsWithSplitFlag = async (
  changes: readonly Change[],
  elementsSource: ReadOnlyElementsSource | undefined,
  remove10KOptionsContexts: boolean,
): Promise<ChangeError[]> => {
  const changedOrders = changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .filter(change => getChangeData(change).elemID.typeName === OPTIONS_ORDER_TYPE_NAME)
    .map(getChangeData)
  if (changedOrders.length === 0) {
    return []
  }
  if (elementsSource === undefined) {
    log.warn('Skipping customFieldsWith10KOptionValidator due to missing elements source')
    return []
  }
  const contextToOptionsCount = await createContextToOptionsCountRecord(elementsSource)
  return remove10KOptionsContexts
    ? blockDeploymentsOfOrdersAndOptions(contextToOptionsCount, changedOrders, changes)
    : warnSlowDeploymentOfOrders(contextToOptionsCount, changedOrders)
}

const check10KOptionsWithoutSplitFlag = async (
  changes: readonly Change[],
  remove10KOptionsContexts: boolean,
): Promise<ChangeError[]> =>
  changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .filter(change => getChangeData(change).elemID.typeName === FIELD_CONTEXT_TYPE_NAME)
    .filter(change => getOptionsFromContext(getChangeData(change)).length > 10000)
    .filter(hasNewOption)
    .map(getChangeData)
    .filter(instance => getParents(instance)[0].elemID.typeName === FIELD_TYPE_NAME)
    .map(instance => (remove10KOptionsContexts ? blockDeploymentError(instance) : slowDeploymentError(instance)))

export const customFieldsWith10KOptionValidator: (config: JiraConfig) => ChangeValidator =
  config => async (changes, elementsSource: ReadOnlyElementsSource | undefined) =>
    config.fetch.splitFieldContextOptions
      ? check10KOptionsWithSplitFlag(changes, elementsSource, config.fetch.remove10KOptionsContexts)
      : check10KOptionsWithoutSplitFlag(changes, config.fetch.remove10KOptionsContexts)
