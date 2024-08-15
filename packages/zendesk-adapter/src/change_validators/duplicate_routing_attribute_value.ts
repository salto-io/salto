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
  CORE_ANNOTATIONS,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isInstanceChange,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { values as lowerDashValues } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { getInstancesFromElementSource } from '@salto-io/adapter-utils'
import { ROUTING_ATTRIBUTE_VALUE_TYPE_NAME } from '../constants'

const { isDefined } = lowerDashValues
const log = logger(module)

const getNameAndParent = (instance: InstanceElement): string => {
  // Unable to use getParent because elements from the elementSource are not resolved
  const parent = (instance.annotations[CORE_ANNOTATIONS.PARENT] ?? [])[0]
  if (isReferenceExpression(parent)) {
    return `${instance.value.name}-${parent.elemID.getFullName()}`
  }
  log.error(`Failed to get parent for instance ${instance.elemID.getFullName()}}`)
  return ''
}

/**
 * Prevents the user from creation of new routing attribute values with the same name as another value in this attribute
 */
export const duplicateRoutingAttributeValueValidator: ChangeValidator = async (changes, elementSource) => {
  if (elementSource === undefined) {
    log.error('Failed to run routingAttributeValueNameValidator because element source is undefined')
    return []
  }

  const routingAttributeValueAdditions = changes
    .filter(isAdditionChange)
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === ROUTING_ATTRIBUTE_VALUE_TYPE_NAME)

  if (routingAttributeValueAdditions === undefined) {
    return []
  }

  const routingAttributeValues = await getInstancesFromElementSource(elementSource, [ROUTING_ATTRIBUTE_VALUE_TYPE_NAME])

  const valueNameAndParentToInstance = _.groupBy(routingAttributeValues, instance => getNameAndParent(instance))

  return routingAttributeValueAdditions
    .map((instance): ChangeError | undefined => {
      const nameAndParent = getNameAndParent(instance)
      const duplicatedValues = _.isEmpty(nameAndParent)
        ? []
        : // Ignore the instance we are checking
          valueNameAndParentToInstance[nameAndParent].filter(
            value => value.elemID.getFullName() !== instance.elemID.getFullName(),
          )

      return duplicatedValues.length > 0
        ? {
            elemID: instance.elemID,
            severity: 'Error',
            message: 'Duplicate routing attribute value',
            detailedMessage: `This routing attribute value has the same name and is under the same routing attribute as '${duplicatedValues.map(inst => inst.elemID.getFullName()).join(', ')}'`,
          }
        : undefined
    })
    .filter(isDefined)
}
