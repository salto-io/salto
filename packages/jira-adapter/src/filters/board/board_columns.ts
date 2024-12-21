/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  AdditionChange,
  CORE_ANNOTATIONS,
  Element,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isInstanceElement,
  isModificationChange,
  ModificationChange,
  Values,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { resolveChangeElement } from '@salto-io/adapter-components'

import _ from 'lodash'
import Joi from 'joi'
import { collections } from '@salto-io/lowerdash'
import { FilterCreator } from '../../filter'
import { BOARD_COLUMN_CONFIG_TYPE, BOARD_TYPE_NAME, KANBAN_TYPE } from '../../constants'
import { addAnnotationRecursively, findObject, setFieldDeploymentAnnotations } from '../../utils'
import JiraClient from '../../client/client'
import { getLookUpName } from '../../reference_mapping'

const { awu } = collections.asynciterable

export const COLUMNS_CONFIG_FIELD = 'columnConfig'

const log = logger(module)

type BoardConfigResponse = {
  [COLUMNS_CONFIG_FIELD]: {
    columns: {
      name: string
    }[]
  }
}

const BOARD_CONFIG_RESPONSE_SCHEME = Joi.object({
  [COLUMNS_CONFIG_FIELD]: Joi.object({
    columns: Joi.array().items(
      Joi.object({
        name: Joi.string().required(),
      }).unknown(true),
    ),
  })
    .unknown(true)
    .required(),
})
  .unknown(true)
  .required()

const isBoardConfigResponse = createSchemeGuard<BoardConfigResponse>(
  BOARD_CONFIG_RESPONSE_SCHEME,
  'Received an invalid board config response',
)

const getColumnsName = async (id: string, client: JiraClient): Promise<string[] | undefined> => {
  const response = await client.get({
    url: `/rest/agile/1.0/board/${id}/configuration`,
  })

  if (!isBoardConfigResponse(response.data)) {
    return undefined
  }

  return response.data[COLUMNS_CONFIG_FIELD].columns.map(({ name }) => name)
}

const convertColumn = (column: Values, isKanPlanColumn: boolean): Values => ({
  name: column.name,
  mappedStatuses: (column.statuses ?? []).map((id: string) => ({ id })),
  min: column.min ?? '',
  max: column.max ?? '',
  isKanPlanColumn,
})

export const deployColumns = async (
  change: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>,
  client: JiraClient,
  retriesLeft: number,
): Promise<void> => {
  const resolvedChange = await resolveChangeElement(change, getLookUpName)

  if (
    isModificationChange(resolvedChange) &&
    _.isEqual(
      resolvedChange.data.before.value[COLUMNS_CONFIG_FIELD],
      resolvedChange.data.after.value[COLUMNS_CONFIG_FIELD],
    )
  ) {
    return
  }

  if (isAdditionChange(resolvedChange) && resolvedChange.data.after.value[COLUMNS_CONFIG_FIELD] === undefined) {
    return
  }

  const instance = getChangeData(resolvedChange)
  const isKanban = instance.value.type === KANBAN_TYPE
  await client.putPrivate({
    url: '/rest/greenhopper/1.0/rapidviewconfig/columns',
    data: {
      currentStatisticsField: {
        id:
          instance.value[COLUMNS_CONFIG_FIELD].constraintType !== undefined
            ? `${instance.value[COLUMNS_CONFIG_FIELD].constraintType}_`
            : 'none_',
      },
      rapidViewId: instance.value.id,
      mappedColumns: instance.value[COLUMNS_CONFIG_FIELD].columns.map(
        // first column in kanban is always system backlog, enforced by a CV
        (column: Values, index: number) => convertColumn(column, index === 0 && isKanban),
      ),
    },
  })

  const columnsToUpdate = instance.value[COLUMNS_CONFIG_FIELD].columns.map(({ name }: Values) => name)

  const updatedColumns = await getColumnsName(instance.value.id, client)
  if (isKanban) {
    log.info(
      `Columns of ${getChangeData(change).elemID.getFullName()} are ${updatedColumns?.join(', ')}, and the columnsToUpdate are ${columnsToUpdate.join(', ')}`,
    )
  }

  if (updatedColumns !== undefined && !_.isEqual(columnsToUpdate, updatedColumns)) {
    log.warn(
      `Failed to update columns of ${instance.elemID.getFullName()} - ${updatedColumns.join(', ')}, retries left - ${retriesLeft}`,
    )
    if (retriesLeft > 0) {
      await deployColumns(change, client, retriesLeft - 1)
    } else {
      throw new Error(`Failed to update columns of ${instance.elemID.getFullName()}`)
    }
  }
}

const filter: FilterCreator = ({ config }) => ({
  name: 'boardColumnsFilter',
  onFetch: async (elements: Element[]) => {
    await awu(elements)
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === BOARD_TYPE_NAME)
      .filter(instance => instance.value.config?.[COLUMNS_CONFIG_FIELD] !== undefined)
      .forEach(async instance => {
        instance.value[COLUMNS_CONFIG_FIELD] = instance.value.config[COLUMNS_CONFIG_FIELD]
        delete instance.value.config[COLUMNS_CONFIG_FIELD]

        instance.value[COLUMNS_CONFIG_FIELD].columns.forEach((column: Values) => {
          if (column.statuses !== undefined) {
            column.statuses = column.statuses.map((status: Values) => status.id)
          }
        })
      })

    if (!config.client.usePrivateAPI) {
      log.debug('Skipping board columns filter because private API is not enabled')
      return
    }

    const columnConfigType = findObject(elements, BOARD_COLUMN_CONFIG_TYPE)
    const boardType = findObject(elements, BOARD_TYPE_NAME)

    if (columnConfigType === undefined || boardType === undefined) {
      return
    }

    setFieldDeploymentAnnotations(boardType, COLUMNS_CONFIG_FIELD)
    boardType.fields.columnConfig.annotations[CORE_ANNOTATIONS.REQUIRED] = true
    await addAnnotationRecursively(columnConfigType, CORE_ANNOTATIONS.CREATABLE)
    await addAnnotationRecursively(columnConfigType, CORE_ANNOTATIONS.UPDATABLE)
  },
})

export default filter
