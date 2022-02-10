/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { Change, CORE_ANNOTATIONS, Element, getChangeData, InstanceElement, isAdditionChange, isInstanceChange } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { resolveValues, safeJsonStringify } from '@salto-io/adapter-utils'
import { findObject } from '../../utils'
import { FilterCreator } from '../../filter'
import { PRIVATE_API_HEADERS } from '../../constants'
import { deployChanges } from '../../deployment'
import { getLookUpName } from '../../reference_mapping'
import JiraClient from '../../client/client'
import { queryStatuses } from './missing_statuses'

const STATUS_TYPE_NAME = 'Status'

const NO_CATEGORY_ID = '1'

const log = logger(module)

const deployStatus = async (
  statusChange: Change<InstanceElement>,
  client: JiraClient,
): Promise<void> => {
  const statusInstance = getChangeData(statusChange)
  const resolvedStatusInstance = await resolveValues(
    statusInstance,
    getLookUpName
  )

  try {
    await client.post({
      url: '/rest/workflowDesigner/1.0/workflows/statuses/create',
      headers: PRIVATE_API_HEADERS,
      data: {
        name: [resolvedStatusInstance.value.name],
        description: [resolvedStatusInstance.value.description],
        statusCategoryId: [resolvedStatusInstance.value.statusCategory?.id ?? NO_CATEGORY_ID],
      },
    })
  } catch (err) {
    // When the status is created successfully, we get this error.
    if (err.response?.status === 400 && err.response.data === 'Given status does not exist') {
      return
    }
    log.error(`Failed to deploy status, response data: ${safeJsonStringify(err.response?.data)}`)
    throw err
  }
}

const addIdsToResults = async (
  appliedChanges: Change<InstanceElement>[],
  client: JiraClient
): Promise<void> => {
  if (appliedChanges.length === 0) {
    return
  }

  try {
    const statuses = await queryStatuses(client)
    const nameToId = Object.fromEntries(statuses.map(status => [status.name, status.id]))

    appliedChanges.forEach(change => {
      getChangeData(change).value.id = nameToId[getChangeData(change).value.name]
    })
  } catch (err) {
    log.error(`Failed to query statuses to add the ids the new statuses: ${err.message}`)
  }
}

const filter: FilterCreator = ({ client, config }) => ({
  onFetch: async (elements: Element[]) => {
    if (!config.client.usePrivateAPI) {
      log.debug('Skipping status deployment filter because private API is not enabled')
      return
    }

    const statusType = findObject(elements, STATUS_TYPE_NAME)
    if (statusType === undefined) {
      log.warn(`${STATUS_TYPE_NAME} type not found, skipping status deployment filter`)
      return
    }

    statusType.annotations[CORE_ANNOTATIONS.CREATABLE] = true
    statusType.fields.name.annotations[CORE_ANNOTATIONS.CREATABLE] = true
    statusType.fields.description.annotations[CORE_ANNOTATIONS.CREATABLE] = true
    statusType.fields.statusCategory.annotations[CORE_ANNOTATIONS.CREATABLE] = true
  },

  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change)
        && isAdditionChange(change)
        && getChangeData(change).elemID.typeName === STATUS_TYPE_NAME
    )

    const deployResult = await deployChanges(
      relevantChanges
        .filter(isInstanceChange),
      change => deployStatus(
        change,
        client,
      )
    )

    await addIdsToResults(deployResult.appliedChanges.filter(isInstanceChange), client)

    const [invalidChanges, validChanges] = _.partition(
      deployResult.appliedChanges,
      change => isInstanceChange(change) && getChangeData(change).value.id === undefined,
    )

    return {
      leftoverChanges,
      deployResult: {
        appliedChanges: validChanges,
        errors: [...deployResult.errors, ...invalidChanges.map(change => new Error(`Could not find the new id of ${getChangeData(change).elemID.getFullName()} after creating it`))],
      },
    }
  },
})

export default filter
