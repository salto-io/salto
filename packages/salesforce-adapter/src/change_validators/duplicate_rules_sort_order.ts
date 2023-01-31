/*
*                      Copyright 2023 Salto Labs Ltd.
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
  Change, ChangeError,
  ChangeValidator, getChangeData, InstanceElement,
  isAdditionOrModificationChange, isInstanceChange,
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
  }).unknown(true).required(),
}).unknown(true).required()


const isValidDuplicateRuleInstance = createSchemeGuard<DuplicateRuleInstance>(DUPLICATE_RULE_INSTANCE_SCHEMA)

const getRelatedObjectName = (instance: DuplicateRuleInstance): string => (
  instance.value[INSTANCE_FULL_NAME_FIELD].split('.')[0]
)

const createSortOrderError = (
  instance: DuplicateRuleInstance,
  objectName: string,
  order: number[]
): ChangeError => ({
  elemID: instance.elemID,
  severity: 'Error',
  message: `Duplicate rule instances for ${objectName} must be in sequential order.`,
  detailedMessage: `Please set or update the order of the instances while making sure it starts from 1 and always increases by 1 (gaps are not allowed). Order is: ${order}`,
})

/**
 * Validates the values in the array are in sequential order starting from 1.
 */
const isInvalidSortOrder = (sortOrders: number[]): boolean => (
  sortOrders
    .sort()
    .some((sortOrder, index) => sortOrder !== index + 1)
)

const changeValidator: ChangeValidator = async (changes, elementsSource) => {
  if (elementsSource === undefined) {
    return []
  }
  const relatedChangesByObjectName = _.groupBy(
    await awu(changes)
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .filter(isInstanceOfTypeChange(DUPLICATE_RULE_METADATA_TYPE))
      .filter(change => isValidDuplicateRuleInstance(getChangeData(change)))
      .toArray() as Change<DuplicateRuleInstance>[],
    change => getRelatedObjectName(getChangeData(change))
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
    _.mapValues(
      relevantDuplicateRuleInstancesByObjectName,
      instances => instances.map(instance => instance.value.sortOrder).sort()
    ),
    isInvalidSortOrder,
  )

  const invalidChangesByObjectName = _.pick(
    relatedChangesByObjectName,
    Object.keys(invalidSortOrderByObjectName)
  )

  return Object.entries(invalidChangesByObjectName)
    .flatMap(([objectName, invalidChanges]) =>
      invalidChanges
        .map(getChangeData)
        .map(instance => createSortOrderError(
          instance,
          objectName,
          invalidSortOrderByObjectName[objectName]
        )))
}

export default changeValidator
