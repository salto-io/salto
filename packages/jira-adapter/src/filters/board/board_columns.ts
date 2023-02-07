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
import { AdditionChange, CORE_ANNOTATIONS, Element, getChangeData, InstanceElement, isAdditionChange, isInstanceElement, isModificationChange, ModificationChange, Values } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { createSchemeGuard, resolveChangeElement } from '@salto-io/adapter-utils'
import _ from 'lodash'
import Joi from 'joi'
import { collections } from '@salto-io/lowerdash'
import { FilterCreator } from '../../filter'
import { BOARD_COLUMN_CONFIG_TYPE, BOARD_TYPE_NAME } from '../../constants'
import { addAnnotationRecursively, findObject, setFieldDeploymentAnnotations } from '../../utils'
import JiraClient from '../../client/client'
import { getLookUpName } from '../../reference_mapping'

const { awu } = collections.asynciterable

const KANBAN_TYPE = 'kanban'
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
    columns: Joi.array().items(Joi.object({
      name: Joi.string().required(),
    }).unknown(true)),
  }).unknown(true).required(),
}).unknown(true).required()

const isBoardConfigResponse = createSchemeGuard<BoardConfigResponse>(BOARD_CONFIG_RESPONSE_SCHEME, 'Received an invalid board config response')

const getColumnsName = async (id: string, client: JiraClient): Promise<string[] | undefined> => {
  const response = await client.getSinglePage({
    url: `/rest/agile/1.0/board/${id}/configuration`,
  })

  if (!isBoardConfigResponse(response.data)) {
    return undefined
  }

  return response.data[COLUMNS_CONFIG_FIELD].columns.map(({ name }) => name)
}

const convertColumn = (column: Values): Values => ({
  name: column.name,
  mappedStatuses: (column.statuses ?? []).map((id: string) => ({ id })),
  min: column.min ?? '',
  max: column.max ?? '',
})

export const deployColumns = async (
  change: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>,
  client: JiraClient,
  retriesLeft: number,
): Promise<void> => {
  const resolvedChange = await resolveChangeElement(change, getLookUpName)

  if (isModificationChange(resolvedChange)
  && _.isEqual(
    resolvedChange.data.before.value[COLUMNS_CONFIG_FIELD],
    resolvedChange.data.after.value[COLUMNS_CONFIG_FIELD]
  )) {
    return
  }

  if (isAdditionChange(resolvedChange)
    && resolvedChange.data.after.value[COLUMNS_CONFIG_FIELD] === undefined) {
    return
  }

  const instance = getChangeData(resolvedChange)

  await client.putPrivate({
    url: '/rest/greenhopper/1.0/rapidviewconfig/columns',
    data: {
      currentStatisticsField: {
        id: instance.value[COLUMNS_CONFIG_FIELD].constraintType !== undefined
          ? `${instance.value[COLUMNS_CONFIG_FIELD].constraintType}_`
          : 'none_',
      },
      rapidViewId: instance.value.id,
      mappedColumns: instance.value[COLUMNS_CONFIG_FIELD].columns.map(convertColumn),
    },
  })

  const columnsToUpdate = instance.value[COLUMNS_CONFIG_FIELD].columns
    .map(({ name }: Values) => name)

  const updatedColumns = await getColumnsName(instance.value.id, client)
  if (instance.value.type === KANBAN_TYPE) {
    log.info(`Columns of ${getChangeData(change).elemID.getFullName()} are ${updatedColumns?.join(', ')}, and the columnsToUpdate are ${columnsToUpdate.join(', ')}`)
    // In Kanban boards, the first column is always backlog, which is non-editable.
    updatedColumns?.shift()
  }

  if (updatedColumns !== undefined && !_.isEqual(columnsToUpdate, updatedColumns)) {
    log.warn(`Failed to update columns of ${instance.elemID.getFullName()} - ${updatedColumns.join(', ')}, retries left - ${retriesLeft}`)
    if (retriesLeft > 0) {
      await deployColumns(change, client, retriesLeft - 1)
    } else {
      throw new Error(`Failed to update columns of ${instance.elemID.getFullName()}`)
    }
  }
}

const removeRedundantColumns = async (
  instance: InstanceElement,
  client: JiraClient,
): Promise<void> => {
  if (instance.value.type !== KANBAN_TYPE) {
    return
  }

  log.info(`Removing first column from ${instance.elemID.getFullName()} with ${instance.value[COLUMNS_CONFIG_FIELD].columns.map((col: Values) => col.name).join(', ')}`)
  // In Kanban boards, the first column is always backlog, which is non-editable.
  // Not removing it will make us create another backlog column.
  instance.value[COLUMNS_CONFIG_FIELD].columns.shift()

  // In some rare cases, we get from the API two Backlog columns.
  // So we need to check if it's a redundant columns or it was really
  // added by the user.
  if (instance.value[COLUMNS_CONFIG_FIELD].columns[0]?.name !== 'Backlog') {
    return
  }

  log.info(`${instance.elemID.getFullName()} has two backlog columns`)
  const columnsName = await getColumnsName(instance.value.id, client)

  if (columnsName === undefined) {
    return
  }

  if (columnsName[1] !== 'Backlog') {
    log.info(`${instance.elemID.getFullName()} removing second backlog column`)
    instance.value[COLUMNS_CONFIG_FIELD].columns.shift()
  } else {
    log.info(`${instance.elemID.getFullName()} leaving second backlog column`)
  }
}

const filter: FilterCreator = ({ config, client }) => ({
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

        await removeRedundantColumns(instance, client)
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
    await addAnnotationRecursively(columnConfigType, CORE_ANNOTATIONS.CREATABLE)
    await addAnnotationRecursively(columnConfigType, CORE_ANNOTATIONS.UPDATABLE)
  },
})

export default filter
