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
import { Change, CORE_ANNOTATIONS, getChangeData, InstanceElement, isAdditionOrModificationChange, isInstanceChange, isModificationChange, isObjectType, Value, Values } from '@salto-io/adapter-api'
import { resolveChangeElement } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { getLookUpName } from '../reference_mapping'
import JiraClient from '../client/client'
import { JiraConfig } from '../config'
import { defaultDeployChange, deployChanges } from '../deployment'
import { FilterCreator } from '../filter'

const FIELD_CONFIG_SCHEME_NAME = 'FieldConfigurationScheme'
const FIELD_CONFIG_SCHEME_ITEM_NAME = 'FieldConfigurationIssueTypeItem'

const log = logger(module)

const deployFieldConfigSchemeItems = async (
  change: Change<InstanceElement>,
  client: JiraClient,
): Promise<void> => {
  const resolvedChange = await resolveChangeElement(change, getLookUpName)

  const afterIds = new Set(isAdditionOrModificationChange(resolvedChange)
    ? resolvedChange.data.after.value.items?.map((item: Values) => item.issueTypeId) ?? []
    : [])


  const itemsToAdd = isAdditionOrModificationChange(resolvedChange)
    ? resolvedChange.data.after.value.items ?? []
    : []

  const itemsToRemove = isModificationChange(resolvedChange)
    ? resolvedChange.data.before.value.items
      ?.map((item: Values) => item.issueTypeId)
      .filter(
        (issueTypeId: Value) => !afterIds.has(issueTypeId)
      ) ?? []
    : []

  const instance = getChangeData(change)
  if (itemsToAdd.length > 0) {
    await client.put({
      url: `/rest/api/3/fieldconfigurationscheme/${instance.value.id}/mapping`,
      data: {
        mappings: itemsToAdd,
      },
    })
  }

  if (itemsToRemove.length > 0) {
    await client.post({
      url: `/rest/api/3/fieldconfigurationscheme/${instance.value.id}/mapping/delete`,
      data: {
        issueTypeIds: itemsToRemove,
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
  onFetch: async elements => {
    const types = elements.filter(isObjectType)
    const fieldConfigurationSchemeType = types.find(
      type => type.elemID.name === FIELD_CONFIG_SCHEME_NAME
    )

    if (fieldConfigurationSchemeType === undefined) {
      log.warn(`${FIELD_CONFIG_SCHEME_NAME} type not found`)
    } else {
      fieldConfigurationSchemeType.fields.items.annotations[CORE_ANNOTATIONS.CREATABLE] = true
      fieldConfigurationSchemeType.fields.items.annotations[CORE_ANNOTATIONS.UPDATABLE] = true
    }

    const fieldConfigurationIssueTypeItemType = types.find(
      type => type.elemID.name === FIELD_CONFIG_SCHEME_ITEM_NAME
    )

    if (fieldConfigurationIssueTypeItemType === undefined) {
      log.warn(`${FIELD_CONFIG_SCHEME_ITEM_NAME} type not found`)
    } else {
      fieldConfigurationIssueTypeItemType.fields.issueTypeId
        .annotations[CORE_ANNOTATIONS.CREATABLE] = true
      fieldConfigurationIssueTypeItemType.fields.issueTypeId
        .annotations[CORE_ANNOTATIONS.UPDATABLE] = true

      fieldConfigurationIssueTypeItemType.fields.fieldConfigurationId
        .annotations[CORE_ANNOTATIONS.CREATABLE] = true
      fieldConfigurationIssueTypeItemType.fields.fieldConfigurationId
        .annotations[CORE_ANNOTATIONS.UPDATABLE] = true
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
