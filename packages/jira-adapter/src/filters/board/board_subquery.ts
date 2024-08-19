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
  isInstanceElement,
  isModificationChange,
  ModificationChange,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../../filter'
import { BOARD_TYPE_NAME } from '../../constants'
import { findObject } from '../../utils'
import JiraClient from '../../client/client'

const log = logger(module)

export const deploySubQuery = async (
  change: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>,
  client: JiraClient,
): Promise<void> => {
  if (isModificationChange(change) && change.data.before.value.subQuery === change.data.after.value.subQuery) {
    return
  }

  const instance = getChangeData(change)

  await client.putPrivate({
    url: `/rest/greenhopper/1.0/subqueries/${instance.value.id}`,
    data: {
      query: instance.value.subQuery ?? '',
    },
  })
}

const filter: FilterCreator = ({ config }) => ({
  name: 'boardSubQueryFilter',
  onFetch: async (elements: Element[]) => {
    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === BOARD_TYPE_NAME)
      .filter(instance => instance.value.config?.subQuery !== undefined)
      .forEach(instance => {
        instance.value.subQuery = instance.value.config.subQuery.query
        delete instance.value.config.subQuery
      })

    const boardType = findObject(elements, BOARD_TYPE_NAME)

    if (boardType === undefined) {
      return
    }

    if (!config.client.usePrivateAPI) {
      log.debug('Skipping board sub query filter because private API is not enabled')
      return
    }

    boardType.fields.subQuery.annotations[CORE_ANNOTATIONS.CREATABLE] = true
    boardType.fields.subQuery.annotations[CORE_ANNOTATIONS.UPDATABLE] = true
  },
})

export default filter
