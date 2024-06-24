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
import { logger } from '@salto-io/logging'
import { isResolvedReferenceExpression } from '@salto-io/adapter-utils'
import { JiraConfig } from '../../config/config'
import { FilterCreator } from '../../filter'
import { defaultDeployChange, deployChanges } from '../../deployment/standard_deployment'

const FIELD_CONFIGURATION_TYPE_NAME = 'FieldConfiguration'

const log = logger(module)

const deployFieldConfigurationItems = async (
  instance: InstanceElement,
  client: clientUtils.HTTPWriteClientInterface,
  config: JiraConfig,
): Promise<void> => {
  const fields = (instance.value.fields ?? [])
    .filter((fieldConf: Values) => isResolvedReferenceExpression(fieldConf.id))
    .map((fieldConf: Values) => ({ ...fieldConf, id: fieldConf.id.value.value.id }))

  if (fields.length === 0) {
    return
  }

  await Promise.all(
    _.chunk(fields, config.client.fieldConfigurationItemsDeploymentLimit).map(async fieldsChunk =>
      client.put({
        url: `/rest/api/3/fieldconfiguration/${instance.value.id}/fields`,
        data: {
          fieldConfigurationItems: fieldsChunk,
        },
      }),
    ),
  )
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
