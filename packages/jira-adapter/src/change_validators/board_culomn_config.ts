/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { BOARD_TYPE_NAME } from '../constants'

const { awu } = collections.asynciterable

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
  awu(changes)
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === BOARD_TYPE_NAME)
    .filter(isInvalidColumnConfig)
    .map(async instance => ({
      elemID: instance.elemID,
      severity: 'Error' as SeverityLevel,
      message: 'Unable to deploy Board without Columns and Statuses.',
      detailedMessage:
        'The board must have at least one column, and at least one of these columns must include a status. Please verify that these conditions are met before deploying it.',
    }))
    .toArray()
