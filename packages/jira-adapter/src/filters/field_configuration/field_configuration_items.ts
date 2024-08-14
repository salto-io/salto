/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  AdditionChange,
  DeployResult,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceChange,
  ModificationChange,
  Values,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { getParent } from '@salto-io/adapter-utils'
import { resolveValues, client as clientUtils } from '@salto-io/adapter-components'

import { collections } from '@salto-io/lowerdash'
import { FilterCreator } from '../../filter'
import { JiraConfig } from '../../config/config'
import { FIELD_CONFIGURATION_ITEM_TYPE_NAME } from '../../constants'
import { getLookUpName } from '../../reference_mapping'
import JiraClient from '../../client/client'

const { awu } = collections.asynciterable

const putFieldItemsChunk = async (
  client: JiraClient,
  parentId: string,
  fieldsChunk: Values[],
): Promise<clientUtils.Response<clientUtils.ResponseValue | clientUtils.ResponseValue[]>> =>
  client.put({
    url: `/rest/api/3/fieldconfiguration/${parentId}/fields`,
    data: {
      fieldConfigurationItems: fieldsChunk,
    },
  })

const deployFieldConfigurationItems = async (
  changes: Array<AdditionChange<InstanceElement> | ModificationChange<InstanceElement>>,
  client: JiraClient,
  config: JiraConfig,
): Promise<void> => {
  const fields = await awu(changes)
    .map(getChangeData)
    .map(instance => resolveValues(instance, getLookUpName))
    .map(instance => instance.value)
    .toArray()

  if (fields.length === 0) {
    return
  }

  const parentId = getParent(getChangeData(changes[0])).value.id

  const fieldChunks = _.chunk(fields, config.client.fieldConfigurationItemsDeploymentLimit)
  if (client.isDataCenter) {
    // in DC calling deploy in parallel for field configuration items causes deadlocks and data corruption
    await awu(fieldChunks).forEach(async fieldsChunk => putFieldItemsChunk(client, parentId, fieldsChunk))
  } else {
    await Promise.all(fieldChunks.map(async fieldsChunk => putFieldItemsChunk(client, parentId, fieldsChunk)))
  }
}

const filter: FilterCreator = ({ client, config }) => ({
  name: 'fieldConfigurationItemsFilter',
  deploy: async changes => {
    if (!config.fetch.splitFieldConfiguration) {
      return {
        leftoverChanges: changes,
        deployResult: {
          errors: [],
          appliedChanges: [],
        },
      }
    }

    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change =>
        isInstanceChange(change) && getChangeData(change).elemID.typeName === FIELD_CONFIGURATION_ITEM_TYPE_NAME,
    )

    let deployResult: DeployResult

    try {
      await deployFieldConfigurationItems(
        relevantChanges.filter(isInstanceChange).filter(isAdditionOrModificationChange),
        client,
        config,
      )

      deployResult = {
        errors: [],
        appliedChanges: relevantChanges,
      }
    } catch (err) {
      deployResult = {
        errors: [err],
        appliedChanges: [],
      }
    }

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filter
