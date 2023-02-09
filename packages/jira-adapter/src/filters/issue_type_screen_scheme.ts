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
import { CORE_ANNOTATIONS, getChangeData, InstanceElement, isInstanceChange, isModificationChange, isObjectType, ModificationChange, Values } from '@salto-io/adapter-api'
import { resolveChangeElement } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { getLookUpName } from '../reference_mapping'
import JiraClient from '../client/client'
import { JiraConfig } from '../config/config'
import { defaultDeployChange, deployChanges } from '../deployment/standard_deployment'
import { FilterCreator } from '../filter'

const ISSUE_TYPE_SCREEN_SCHEME_NAME = 'IssueTypeScreenScheme'
const ISSUE_TYPE_SCREEN_SCHEME_ITEM_NAME = 'IssueTypeScreenSchemeItem'

const log = logger(module)

const DEFAULT_ISSUE_TYPE = 'default'

const deployIssueTypeMappings = async (
  change: ModificationChange<InstanceElement>,
  client: JiraClient,
): Promise<void> => {
  const afterItemsMap = _.keyBy(
    change.data.after.value.issueTypeMappings ?? [],
    (mapping: Values) => mapping.issueTypeId
  )

  const beforeItemsMap = _.keyBy(
    change.data.before.value.issueTypeMappings ?? [],
    (mapping: Values) => mapping.issueTypeId
  )

  const itemsToAdd = (change.data.after.value.issueTypeMappings ?? [])
    .filter((mapping: Values) =>
      mapping.issueTypeId !== DEFAULT_ISSUE_TYPE
      && (beforeItemsMap[mapping.issueTypeId] === undefined
        || !_.isEqual(beforeItemsMap[mapping.issueTypeId], mapping)
      ))

  const itemsToRemove = (change.data.before.value.issueTypeMappings ?? [])
    .filter((mapping: Values) =>
      mapping.issueTypeId !== DEFAULT_ISSUE_TYPE
      && (afterItemsMap[mapping.issueTypeId] === undefined
        || !_.isEqual(afterItemsMap[mapping.issueTypeId], mapping)
      ))

  const instance = getChangeData(change)

  if (itemsToRemove.length > 0) {
    await client.post({
      url: `/rest/api/3/issuetypescreenscheme/${instance.value.id}/mapping/remove`,
      data: {
        issueTypeIds: itemsToRemove.map((mapping: Values) => mapping.issueTypeId),
      },
    })
  }

  if (itemsToAdd.length > 0) {
    await client.put({
      url: `/rest/api/3/issuetypescreenscheme/${instance.value.id}/mapping`,
      data: {
        issueTypeMappings: itemsToAdd,
      },
    })
  }
}

const deployDefaultMapping = async (
  change: ModificationChange<InstanceElement>,
  client: JiraClient,
): Promise<void> => {
  const defaultBefore = change.data.before.value.issueTypeMappings
    ?.find((mapping: Values) => mapping.issueTypeId === DEFAULT_ISSUE_TYPE)
  const defaultAfter = change.data.after.value.issueTypeMappings
    ?.find((mapping: Values) => mapping.issueTypeId === DEFAULT_ISSUE_TYPE)

  if (defaultAfter?.screenSchemeId === undefined) {
    throw new Error(`instance ${getChangeData(change).elemID.getFullName()} must have a default screen scheme`)
  }

  const instance = getChangeData(change)
  if (defaultBefore?.screenSchemeId !== defaultAfter?.screenSchemeId) {
    await client.put({
      url: `/rest/api/3/issuetypescreenscheme/${instance.value.id}/mapping/default`,
      data: {
        screenSchemeId: defaultAfter?.screenSchemeId,
      },
    })
  }
}

const deployIssueTypeScreenSchema = async (
  change: ModificationChange<InstanceElement>,
  client: JiraClient,
  config: JiraConfig,
): Promise<void> => {
  await defaultDeployChange({
    change,
    client,
    apiDefinitions: config.apiDefinitions,
    fieldsToIgnore: ['issueTypeMappings'],
  })
  await deployIssueTypeMappings(change, client)
  await deployDefaultMapping(change, client)
}

const filter: FilterCreator = ({ config, client }) => ({
  name: 'issueTypeScreenSchemeFilter',
  onFetch: async elements => {
    const types = elements.filter(isObjectType)
    const issueTypeScreenSchemaType = types
      .find(element => element.elemID.name === ISSUE_TYPE_SCREEN_SCHEME_NAME)

    if (issueTypeScreenSchemaType === undefined) {
      log.warn(`${ISSUE_TYPE_SCREEN_SCHEME_NAME} type was not found`)
    } else {
      issueTypeScreenSchemaType.fields.issueTypeMappings
        .annotations[CORE_ANNOTATIONS.UPDATABLE] = true
    }

    const issueTypeScreenSchemaItemType = types
      .find(element => element.elemID.name === ISSUE_TYPE_SCREEN_SCHEME_ITEM_NAME)

    if (issueTypeScreenSchemaItemType === undefined) {
      log.warn(`${ISSUE_TYPE_SCREEN_SCHEME_ITEM_NAME} type was not found`)
    } else {
      issueTypeScreenSchemaItemType.fields.issueTypeId
        .annotations[CORE_ANNOTATIONS.UPDATABLE] = true

      issueTypeScreenSchemaItemType.fields.screenSchemeId
        .annotations[CORE_ANNOTATIONS.UPDATABLE] = true
    }
  },
  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change)
        && isModificationChange(change)
        && getChangeData(change).elemID.typeName === ISSUE_TYPE_SCREEN_SCHEME_NAME
    )

    const deployResult = await deployChanges(
      relevantChanges
        .filter(isInstanceChange)
        .filter(isModificationChange),
      async change => deployIssueTypeScreenSchema(
        await resolveChangeElement(
          change,
          getLookUpName
        ),
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
