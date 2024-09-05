/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ChangeValidator,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceChange,
  ReferenceExpression,
  SeverityLevel,
} from '@salto-io/adapter-api'
import Joi from 'joi'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { BOARD_TYPE_NAME } from '../constants'

type BoardColumn = {
  name: string
  statuses?: (string | ReferenceExpression)[]
}

type BoardColumnConfig = {
  columns: BoardColumn[]
}

const COLUMN_CONFIG_SCHEME = Joi.object({
  columns: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        statuses: Joi.array(),
      }),
    )
    .required(),
})
  .required()
  .unknown(true)

const isBoardColumnConfig = createSchemeGuard<BoardColumnConfig>(COLUMN_CONFIG_SCHEME)

const isInvalidColumnConfig = (boardInstance: InstanceElement): boolean => {
  if (!isBoardColumnConfig(boardInstance.value.columnConfig)) {
    return true
  }
  const { columns } = boardInstance.value.columnConfig
  const hasNonEmptyStatuses = columns.some(column => !_.isEmpty(column.statuses))
  return !hasNonEmptyStatuses
}
export const boardColumnConfigValidator: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === BOARD_TYPE_NAME)
    .filter(isInvalidColumnConfig)
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Error' as SeverityLevel,
      message: 'Unable to deploy Board without Columns and Statuses.',
      detailedMessage:
        'The board must have at least one column, and at least one of these columns must include a status. Please verify that these conditions are met before deploying it.',
    }))
