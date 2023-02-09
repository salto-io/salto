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
import { Change, getChangeData, InstanceElement, isAdditionOrModificationChange, isInstanceChange, isModificationChange } from '@salto-io/adapter-api'
import { resolveChangeElement } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { getLookUpName } from '../reference_mapping'
import JiraClient from '../client/client'
import { JiraConfig } from '../config/config'
import { defaultDeployChange, deployChanges } from '../deployment/standard_deployment'
import { FilterCreator } from '../filter'
import { findObject, setFieldDeploymentAnnotations } from '../utils'
import { getDiffObjects } from '../diff'

const FIELD_CONFIG_SCHEME_NAME = 'FieldConfigurationScheme'
const FIELD_CONFIG_SCHEME_ITEM_NAME = 'FieldConfigurationIssueTypeItem'

const deployFieldConfigSchemeItems = async (
  change: Change<InstanceElement>,
  client: JiraClient,
): Promise<void> => {
  const resolvedChange = await resolveChangeElement(change, getLookUpName)

  const { addedObjects, modifiedObjects, removedObjects } = getDiffObjects(
    isModificationChange(resolvedChange)
      ? resolvedChange.data.before.value.items ?? []
      : [],
    isAdditionOrModificationChange(resolvedChange)
      ? resolvedChange.data.after.value.items ?? []
      : [],
    'issueTypeId'
  )

  const itemsToUpdate = [...modifiedObjects, ...addedObjects]

  const instance = getChangeData(change)
  if (itemsToUpdate.length > 0) {
    await client.put({
      url: `/rest/api/3/fieldconfigurationscheme/${instance.value.id}/mapping`,
      data: {
        mappings: itemsToUpdate,
      },
    })
  }

  if (removedObjects.length > 0) {
    await client.post({
      url: `/rest/api/3/fieldconfigurationscheme/${instance.value.id}/mapping/delete`,
      data: {
        issueTypeIds: removedObjects.map(obj => obj.issueTypeId),
      },
    })
  }
}

const deployFieldConfigScheme = async (
  change: Change<InstanceElement>,
  client: JiraClient,
  config: JiraConfig,
): Promise<void> => {
  await defaultDeployChange({
    change,
    client,
    apiDefinitions: config.apiDefinitions,
    fieldsToIgnore: ['items'],
  })
  await deployFieldConfigSchemeItems(change, client)
}

const filter: FilterCreator = ({ config, client }) => ({
  name: 'fieldConfigurationSchemeFilter',
  onFetch: async elements => {
    const fieldConfigurationSchemeType = findObject(elements, FIELD_CONFIG_SCHEME_NAME)

    if (fieldConfigurationSchemeType !== undefined) {
      setFieldDeploymentAnnotations(fieldConfigurationSchemeType, 'items')
    }

    const fieldConfigurationIssueTypeItemType = findObject(elements, FIELD_CONFIG_SCHEME_ITEM_NAME)

    if (fieldConfigurationIssueTypeItemType !== undefined) {
      setFieldDeploymentAnnotations(fieldConfigurationIssueTypeItemType, 'issueTypeId')
      setFieldDeploymentAnnotations(fieldConfigurationIssueTypeItemType, 'fieldConfigurationId')
    }
  },
  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change)
        && isAdditionOrModificationChange(change)
        && getChangeData(change).elemID.typeName === FIELD_CONFIG_SCHEME_NAME
    )

    const deployResult = await deployChanges(
      relevantChanges.filter(isInstanceChange),
      async change => deployFieldConfigScheme(
        change,
        client,
        config
      )
    )

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filter
