/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Change,
  getChangeData,
  InstanceElement,
  isInstanceChange,
  isModificationChange,
  isRemovalChange,
  Values,
} from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { isResolvedReferenceExpression } from '@salto-io/adapter-utils'
import { JiraConfig } from '../../config/config'
import { FilterCreator } from '../../filter'
import { defaultDeployChange, deployChanges } from '../../deployment/standard_deployment'
import JiraClient from '../../client/client'

const FIELD_CONFIGURATION_TYPE_NAME = 'FieldConfiguration'

const { awu } = collections.asynciterable
const log = logger(module)

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
  instance: InstanceElement,
  client: JiraClient,
  config: JiraConfig,
): Promise<void> => {
  const fields: Values[] = (instance.value.fields ?? [])
    .filter((fieldConf: Values) => isResolvedReferenceExpression(fieldConf.id))
    .map((fieldConf: Values) => ({ ...fieldConf, id: fieldConf.id.value.value.id }))

  if (fields.length === 0) {
    return
  }

  const fieldChunks = _.chunk(fields, config.client.fieldConfigurationItemsDeploymentLimit)
  if (client.isDataCenter) {
    // in DC calling deploy in parallel for field configuration items causes deadlocks and data corruption
    await awu(fieldChunks).forEach(async fieldsChunk => putFieldItemsChunk(client, instance.value.id, fieldsChunk))
  } else {
    await Promise.all(fieldChunks.map(async fieldsChunk => putFieldItemsChunk(client, instance.value.id, fieldsChunk)))
  }
}

const filter: FilterCreator = ({ config, client }) => ({
  name: 'fieldConfigurationDeployment',
  deploy: async changes => {
    if (config.fetch.splitFieldConfiguration) {
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
        isInstanceChange(change) &&
        getChangeData(change).elemID.typeName === FIELD_CONFIGURATION_TYPE_NAME &&
        !isRemovalChange(change),
    )

    const deployResult = await deployChanges(relevantChanges as Change<InstanceElement>[], async change => {
      const instance = getChangeData(change)
      if (instance.value.isDefault && isModificationChange(change)) {
        log.info(`Skipping default deploy for default ${FIELD_CONFIGURATION_TYPE_NAME} because it is not supported`)
      } else {
        await defaultDeployChange({
          change,
          client,
          apiDefinitions: config.apiDefinitions,
          fieldsToIgnore: ['fields'],
        })
      }
      await deployFieldConfigurationItems(instance, client, config)
    })

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filter
