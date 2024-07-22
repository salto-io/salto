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
  isAdditionOrModificationChange,
  isInstanceElement,
  SeverityLevel,
} from '@salto-io/adapter-api'
import { getParent } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { getOrderNameFromOption } from '../../common/fields'
import { FIELD_CONTEXT_OPTION_TYPE_NAME, OPTIONS_ORDER_TYPE_NAME } from '../../filters/fields/constants'

const getNotInOrderError = (option: InstanceElement): ChangeError => ({
  elemID: option.elemID,
  severity: 'Error' as SeverityLevel,
  message: "This option is not being referenced by it's corresponding order",
  detailedMessage: `The order instance ${getOrderNameFromOption(option)} should reference all it's options`,
})
/**
 * Verify that the context reference all the added/modified options.
 */
export const fieldContextOptionsValidator: ChangeValidator = async changes => {
  const ordersByParent = _.keyBy(
    changes
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === OPTIONS_ORDER_TYPE_NAME),
    instance => getParent(instance).elemID.getFullName(),
  )

  const optionsByParent = _.groupBy(
    changes
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === FIELD_CONTEXT_OPTION_TYPE_NAME),
    instance => getParent(instance).elemID.getFullName(),
  )

  return _.flatMap(optionsByParent, (options, parentFullName) => {
    const order = ordersByParent[parentFullName]
    if (order === undefined) {
      return options.map(getNotInOrderError)
    }
    const orderOptionsHash = _.keyBy(order.value.options, option => option.elemID.getFullName())
    return options.filter(option => orderOptionsHash[option.elemID.getFullName()] === undefined).map(getNotInOrderError)
  })
}
