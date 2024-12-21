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
  isAdditionOrModificationChange,
  isInstanceChange,
  SeverityLevel,
} from '@salto-io/adapter-api'
import Joi from 'joi'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { BOARD_TYPE_NAME, KANBAN_TYPE } from '../../constants'

const BACKLOG = 'Backlog'
type BoardColumn = {
  name: string
}

type BoardColumnConfig = {
  columns: BoardColumn[]
}

const COLUMN_CONFIG_SCHEME = Joi.object({
  columns: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
      }).unknown(true),
    )
    .min(1)
    .required(),
})
  .required()
  .unknown(true)

const isBoardColumnConfig = createSchemeGuard<BoardColumnConfig>(COLUMN_CONFIG_SCHEME)

export const kanbanBoardBacklogValidator: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === BOARD_TYPE_NAME)
    .filter(instance => instance.value.type === KANBAN_TYPE)
    .filter(
      instance =>
        !isBoardColumnConfig(instance.value.columnConfig) || instance.value.columnConfig.columns[0].name !== BACKLOG,
    )
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Error' as SeverityLevel,
      message: 'Unable to deploy a Kanban Board When the first column is not named "Backlog"',
      detailedMessage:
        // Change this message in 1 month, the fetch part is relevant only for deployments before the fix
        'A Kanban board must have a first column named Backlog. If you did not edit the board manually please fetch both envs and try again',
    }))
