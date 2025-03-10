/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Change,
  ChangeError,
  ChangeValidator,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceChange,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import Joi from 'joi'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { DUPLICATE_RULE_METADATA_TYPE, INSTANCE_FULL_NAME_FIELD } from '../constants'
import { isInstanceOfType, isInstanceOfTypeChange } from '../filters/utils'

const { awu } = collections.asynciterable

export const SORT_ORDER = 'sortOrder'

type DuplicateRuleInstance = InstanceElement & {
  value: InstanceElement['value'] & {
    [INSTANCE_FULL_NAME_FIELD]: string
    [SORT_ORDER]: number
  }
}

const DUPLICATE_RULE_INSTANCE_SCHEMA = Joi.object({
  value: Joi.object({
    [INSTANCE_FULL_NAME_FIELD]: Joi.string().required(),
    [SORT_ORDER]: Joi.number().required(),
  })
    .unknown(true)
    .required(),
})
  .unknown(true)
  .required()

const isValidDuplicateRuleInstance = createSchemeGuard<DuplicateRuleInstance>(DUPLICATE_RULE_INSTANCE_SCHEMA)

const getRelatedObjectName = (instance: DuplicateRuleInstance): string =>
  instance.value[INSTANCE_FULL_NAME_FIELD].split('.')[0]

const createSortOrderError = (instance: DuplicateRuleInstance, objectName: string, order: number[]): ChangeError => ({
  elemID: instance.elemID,
  severity: 'Error',
  message: 'Duplicate rule instances must be in sequential order.',
  detailedMessage: `Please set or update the order of the instances in object '${objectName}' while making sure it starts from 1 and always increases by 1 (gaps are not allowed). Order is: ${order}. You can learn more about this deployment preview error here: https://help.salto.io/en/articles/8032257-duplicate-rules-must-be-in-sequential-order`,
})

/**
 * Validates the values in the array are in sequential order starting from 1.
 */

const isInvalidSortOrder = (sortOrders: number[]): boolean =>
  sortOrders.sort((a: number, b: number): number => a - b).some((sortOrder, index) => sortOrder !== index + 1)

const changeValidator: ChangeValidator = async (changes, elementsSource) => {
  if (elementsSource === undefined) {
    return []
  }
  const relatedChangesByObjectName = _.groupBy(
    (await awu(changes)
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .filter(isInstanceOfTypeChange(DUPLICATE_RULE_METADATA_TYPE))
      .filter(change => isValidDuplicateRuleInstance(getChangeData(change)))
      .toArray()) as Change<DuplicateRuleInstance>[],
    change => getRelatedObjectName(getChangeData(change)),
  )
  if (_.isEmpty(relatedChangesByObjectName)) {
    return []
  }
  const x = await awu(await elementsSource.getAll())
    .filter(isInstanceElement)
    .toArray()
  const duplicateRuleInstances = await awu(x)
    .filter(isInstanceOfType(DUPLICATE_RULE_METADATA_TYPE))
    .filter(isValidDuplicateRuleInstance)
    .toArray()

  const relevantDuplicateRuleInstancesByObjectName = _.pick(
    _.groupBy(duplicateRuleInstances, getRelatedObjectName),
    Object.keys(relatedChangesByObjectName),
  )

  const invalidSortOrderByObjectName = _.pickBy(
    _.mapValues(relevantDuplicateRuleInstancesByObjectName, instances =>
      instances.map(instance => instance.value.sortOrder),
    ),
    isInvalidSortOrder,
  )

  const invalidChangesByObjectName = _.pick(relatedChangesByObjectName, Object.keys(invalidSortOrderByObjectName))

  return Object.entries(invalidChangesByObjectName).flatMap(([objectName, invalidChanges]) =>
    invalidChanges
      .map(getChangeData)
      .map(instance => createSortOrderError(instance, objectName, invalidSortOrderByObjectName[objectName])),
  )
}

export default changeValidator
