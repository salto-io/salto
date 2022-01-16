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
import { AdditionChange, CORE_ANNOTATIONS, getChangeData, InstanceElement, isAdditionChange, isAdditionOrModificationChange, isInstanceChange, isModificationChange, isObjectType, ModificationChange, ObjectType } from '@salto-io/adapter-api'
import { resolveChangeElement } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { promises } from '@salto-io/lowerdash'
import { getLookUpName } from '../../reference_mapping'
import JiraClient from '../../client/client'
import { JiraConfig } from '../../config'
import { defaultDeployChange, deployChanges } from '../../deployment'
import { FilterCreator } from '../../filter'
import { getDiffIds } from '../../diff'

const ISSUE_TYPE_SCHEMA_NAME = 'IssueTypeScheme'
const MAX_CONCURRENT_PROMISES = 20

const deployNewAndDeletedIssueTypeIds = async (
  change: ModificationChange<InstanceElement>,
  client: JiraClient,
): Promise<void> => {
  const { addedIds, removedIds } = getDiffIds(
    change.data.before.value.issueTypeIds ?? [],
    change.data.after.value.issueTypeIds ?? []
  )

  const instance = getChangeData(change)
  if (addedIds.length > 0) {
    await client.put({
      url: `/rest/api/3/issuetypescheme/${instance.value.id}/issuetype`,
      data: {
        issueTypeIds: Array.from(addedIds),
      },
    })
  }

  await promises.array.withLimitedConcurrency(
    Array.from(removedIds).map(id => () =>
      client.delete({
        url: `/rest/api/3/issuetypescheme/${instance.value.id}/issuetype/${id}`,
      })),
    MAX_CONCURRENT_PROMISES,
  )
}

const deployIssueTypeIdsOrder = async (
  change: ModificationChange<InstanceElement>,
  client: JiraClient,
): Promise<void> => {
  if ((change.data.after.value.issueTypeIds ?? []).length === 0
    || _.isEqual(
      change.data.before.value.issueTypeIds,
      change.data.after.value.issueTypeIds
    )) {
    return
  }
  await client.put({
    url: `/rest/api/3/issuetypescheme/${getChangeData(change).value.id}/issuetype/move`,
    data: {
      issueTypeIds: change.data.after.value.issueTypeIds,
      position: 'First',
    },
  })
}


const deployIssueTypeSchema = async (
  change: ModificationChange<InstanceElement> | AdditionChange<InstanceElement>,
  client: JiraClient,
  config: JiraConfig,
): Promise<void> => {
  await defaultDeployChange({
    change,
    client,
    apiDefinitions: config.apiDefinitions,
    fieldsToIgnore: isModificationChange(change) ? ['issueTypeIds'] : [],
  })

  if (isAdditionChange(change)) {
    change.data.after.value.id = change.data.after.value.issueTypeSchemeId
    delete change.data.after.value.issueTypeSchemeId
  }

  if (isModificationChange(change)) {
    const resolvedChange = await resolveChangeElement(change, getLookUpName)
    await deployNewAndDeletedIssueTypeIds(resolvedChange, client)
    await deployIssueTypeIdsOrder(resolvedChange, client)
  }
}

const filter: FilterCreator = ({ config, client }) => ({
  onFetch: async elements => {
    const issueTypeSchemaType = elements.find(
      element => isObjectType(element)
        && element.elemID.name === ISSUE_TYPE_SCHEMA_NAME
    ) as ObjectType | undefined
    if (issueTypeSchemaType !== undefined) {
      issueTypeSchemaType.fields.issueTypeIds.annotations[CORE_ANNOTATIONS.UPDATABLE] = true
    }
  },
  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change)
        && isAdditionOrModificationChange(change)
        && getChangeData(change).elemID.typeName === ISSUE_TYPE_SCHEMA_NAME
    )


    const deployResult = await deployChanges(
      relevantChanges
        .filter(isInstanceChange)
        .filter(isAdditionOrModificationChange),
      async change => deployIssueTypeSchema(
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
