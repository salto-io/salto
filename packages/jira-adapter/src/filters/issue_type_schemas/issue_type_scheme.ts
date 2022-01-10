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
import { BuiltinTypes, CORE_ANNOTATIONS, Field, getChangeData, InstanceElement, isInstanceChange, isInstanceElement, isModificationChange, isObjectType, ModificationChange, ObjectType } from '@salto-io/adapter-api'
import { resolveChangeElement } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { promises } from '@salto-io/lowerdash'
import { getLookUpName } from '../../references'
import JiraClient from '../../client/client'
import { JiraConfig } from '../../config'
import { deployChange } from '../../deployment'
import { FilterCreator } from '../../filter'

const ISSUE_TYPE_SCHEMA_NAME = 'IssueTypeScheme'
const MAX_CONCURRENT_PROMISES = 20

const deployNewAndDeletedIssueTypeIds = async (
  change: ModificationChange<InstanceElement>,
  client: JiraClient,
): Promise<void> => {
  const beforeIds = new Set(change.data.before.value.issueTypeIds)
  const afterIds = new Set(change.data.after.value.issueTypeIds)

  const idsToAdd = change.data.after.value.issueTypeIds
    ?.filter((id: string) => !beforeIds.has(id)) ?? []
  const idsToRemove = change.data.before.value.issueTypeIds
    ?.filter((id: string) => !afterIds.has(id)) ?? []

  const instance = getChangeData(change)
  if (idsToAdd.length > 0) {
    await client.put({
      url: `/rest/api/3/issuetypescheme/${instance.value.issueTypeSchemeId}/issuetype`,
      data: {
        issueTypeIds: Array.from(idsToAdd),
      },
    })
  }

  await promises.array.withLimitedConcurrency(
    Array.from(idsToRemove).map(id => () =>
      client.delete({
        url: `/rest/api/3/issuetypescheme/${instance.value.issueTypeSchemeId}/issuetype/${id}`,
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
    url: `/rest/api/3/issuetypescheme/${getChangeData(change).value.issueTypeSchemeId}/issuetype/move`,
    data: {
      issueTypeIds: change.data.after.value.issueTypeIds,
      position: 'First',
    },
  })
}


const deployIssueTypeSchema = async (
  change: ModificationChange<InstanceElement>,
  client: JiraClient,
  config: JiraConfig,
): Promise<void> => {
  await deployChange(change, client, config.apiDefinitions, ['issueTypeIds'])
  await deployNewAndDeletedIssueTypeIds(change, client)
  await deployIssueTypeIdsOrder(change, client)
}

const filter: FilterCreator = ({ config, client }) => ({
  onFetch: async elements => {
    const issueTypeSchemaType = elements.find(
      element => isObjectType(element)
        && element.elemID.name === ISSUE_TYPE_SCHEMA_NAME
    ) as ObjectType | undefined
    if (issueTypeSchemaType !== undefined) {
      issueTypeSchemaType.fields.issueTypeIds.annotations[CORE_ANNOTATIONS.UPDATABLE] = true
      delete issueTypeSchemaType.fields.id
      issueTypeSchemaType.fields.issueTypeSchemeId = new Field(issueTypeSchemaType, 'issueTypeSchemeId', BuiltinTypes.STRING, { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true })
    }

    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === ISSUE_TYPE_SCHEMA_NAME)
      .forEach(instance => {
        instance.value.issueTypeSchemeId = instance.value.id
        delete instance.value.id
      })
  },
  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change)
        && isModificationChange(change)
        && getChangeData(change).elemID.typeName === ISSUE_TYPE_SCHEMA_NAME
    )

    const result = await Promise.all(relevantChanges
      .filter(isInstanceChange)
      .map(async change => {
        try {
          await deployIssueTypeSchema(
            await resolveChangeElement(
              change,
              getLookUpName
            ) as ModificationChange<InstanceElement>,
            client,
            config,
          )
          return change
        } catch (err) {
          if (!_.isError(err)) {
            throw err
          }
          return err
        }
      }))

    const [errors, appliedChanges] = _.partition(result, _.isError)
    return {
      leftoverChanges,
      deployResult: {
        errors,
        appliedChanges,
      },
    }
  },
})

export default filter
