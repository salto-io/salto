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
import { CORE_ANNOTATIONS, getChangeData, InstanceElement, isAdditionChange, isAdditionOrModificationChange, isInstanceChange, ModificationChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import { resolveChangeElement } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../../filter'
import { BOARD_TYPE_NAME } from '../../constants'
import { defaultDeployChange, deployChanges } from '../../deployment/standard_deployment'
import { COLUMNS_CONFIG_FIELD, deployColumns } from './board_columns'
import { deploySubQuery } from './board_subquery'
import { deployEstimation } from './board_estimation'
import JiraClient from '../../client/client'
import { getLookUpName } from '../../reference_mapping'
import { findObject } from '../../utils'

const log = logger(module)

const deployName = async (
  change: ModificationChange<InstanceElement>,
  client: JiraClient
): Promise<void> => {
  if (change.data.before.value.name === change.data.after.value.name) {
    return
  }
  const instance = getChangeData(change)

  await client.putPrivate({
    url: '/rest/greenhopper/1.0/rapidviewconfig/name',
    data: {
      id: instance.value.id,
      name: instance.value.name,
    },
  })
}

const deployLocation = async (
  change: ModificationChange<InstanceElement>,
  client: JiraClient
): Promise<void> => {
  const resolvedChange = await resolveChangeElement(change, getLookUpName)
  if (_.isEqual(resolvedChange.data.before.value.location,
    resolvedChange.data.after.value.location)) {
    return
  }
  const instance = getChangeData(resolvedChange)

  await client.putPrivate({
    url: '/rest/greenhopper/1.0/rapidviewconfig/boardLocation',
    data: {
      locationId: instance.value.location.projectKeyOrId,
      locationType: instance.value.location.type,
      rapidViewId: instance.value.id,
    },
  })
}

const deployFilter = async (
  change: ModificationChange<InstanceElement>,
  client: JiraClient
): Promise<void> => {
  const resolvedChange = await resolveChangeElement(change, getLookUpName)
  if (resolvedChange.data.before.value.filterId === resolvedChange.data.after.value.filterId) {
    return
  }
  const instance = getChangeData(resolvedChange)

  await client.putPrivate({
    url: '/rest/greenhopper/1.0/rapidviewconfig/filter',
    data: {
      savedFilterId: instance.value.filterId,
      id: instance.value.id,
    },
  })
}

const filter: FilterCreator = ({ config, client }) => ({
  name: 'boardDeploymentFilter',
  onFetch: async elements => {
    if (!config.client.usePrivateAPI) {
      log.debug('Private API is not enabled, skipping board deployment filter')
      return
    }

    const boardType = findObject(elements, BOARD_TYPE_NAME)

    if (boardType !== undefined) {
      boardType.annotations[CORE_ANNOTATIONS.UPDATABLE] = true
      boardType.fields.name.annotations[CORE_ANNOTATIONS.UPDATABLE] = true
      boardType.fields.filterId.annotations[CORE_ANNOTATIONS.UPDATABLE] = true
      boardType.fields.location.annotations[CORE_ANNOTATIONS.UPDATABLE] = true
    }

    const locationType = findObject(elements, 'Board_location')

    if (locationType !== undefined) {
      locationType.fields.projectId.annotations[CORE_ANNOTATIONS.UPDATABLE] = true
    }
  },

  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change)
        && getChangeData(change).elemID.typeName === BOARD_TYPE_NAME
        && isAdditionOrModificationChange(change)
    )


    const deployResult = await deployChanges(
      relevantChanges
        .filter(isInstanceChange)
        .filter(isAdditionOrModificationChange),
      async change => {
        if (isAdditionChange(change)) {
          await defaultDeployChange({
            change,
            client,
            apiDefinitions: config.apiDefinitions,
            fieldsToIgnore: [COLUMNS_CONFIG_FIELD, 'subQuery', 'estimation'],
          })
        } else {
          await deployName(change, client)
          await deployLocation(change, client)
          await deployFilter(change, client)
        }

        await deployColumns(change, client, config.client.boardColumnRetry)
        await deploySubQuery(change, client)
        await deployEstimation(change, client)
      }
    )

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filter
