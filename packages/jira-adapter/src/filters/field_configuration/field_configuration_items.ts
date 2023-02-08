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
import { AdditionChange, DeployResult, getChangeData, InstanceElement, isAdditionOrModificationChange, isInstanceChange, ModificationChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import { getParent, resolveValues } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { FilterCreator } from '../../filter'
import { JiraConfig } from '../../config/config'
import { FIELD_CONFIGURATION_ITEM_TYPE_NAME } from '../../constants'
import { getLookUpName } from '../../reference_mapping'
import JiraClient from '../../client/client'

const { awu } = collections.asynciterable

const deployFieldConfigurationItems = async (
  changes: Array<AdditionChange<InstanceElement> | ModificationChange<InstanceElement>>,
  client: JiraClient,
  config: JiraConfig
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

  await Promise.all(
    _.chunk(fields, config.client.fieldConfigurationItemsDeploymentLimit).map(async fieldsChunk =>
      client.put({
        url: `/rest/api/3/fieldconfiguration/${parentId}/fields`,
        data: {
          fieldConfigurationItems: fieldsChunk,
        },
      }))
  )
}

const filter: FilterCreator = ({ client, config }) => ({
  name: 'fieldConfigurationItemsFilter',
  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change)
        && getChangeData(change).elemID.typeName === FIELD_CONFIGURATION_ITEM_TYPE_NAME
    )

    let deployResult: DeployResult

    try {
      await deployFieldConfigurationItems(
        relevantChanges
          .filter(isInstanceChange)
          .filter(isAdditionOrModificationChange),
        client,
        config
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
