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
import { Change, ChangeValidator, getChangeData, InstanceElement, isInstanceChange, isModificationChange, isReferenceExpression, ModificationChange, ReferenceExpression, SeverityLevel } from '@salto-io/adapter-api'
import _ from 'lodash'
import { client as clientUtils } from '@salto-io/adapter-components'
import { collections, values } from '@salto-io/lowerdash'
import JiraClient from '../client/client'
import { ISSUE_TYPE_SCHEMA_NAME, PROJECT_TYPE } from '../constants'

const { awu } = collections.asynciterable
const { isDefined } = values

const isSameRef = (ref1: ReferenceExpression, ref2: ReferenceExpression): boolean =>
  ref1.elemID.isEqual(ref2.elemID)

const getRemovedIssueTypeIds = (change: ModificationChange<InstanceElement>): ReferenceExpression[] => {
  const { before, after } = change.data
  const beforeIssueIds = before.value.issueTypeIds.filter(isReferenceExpression)
  const afterIssueIds = after.value.issueTypeIds.filter(isReferenceExpression)
  return _.differenceWith(beforeIssueIds, afterIssueIds, isSameRef)
}

const getRelevantChanges = (changes: ReadonlyArray<Change>): ModificationChange<InstanceElement>[] =>
  changes
    .filter(isModificationChange)
    .filter(isInstanceChange)
    .filter(change => getChangeData(change).elemID.typeName === ISSUE_TYPE_SCHEMA_NAME)
    .filter(change => getRemovedIssueTypeIds(change).length > 0)

const areIssueTypesUsed = async (
  client: JiraClient,
  issueTypes: string[],
  linkedProjectNames: string[],
): Promise<boolean> => {
  const jql = `project in (${linkedProjectNames.join(',')}) AND issuetype in (${issueTypes.join(',')})`
  let response: clientUtils.Response<clientUtils.ResponseValue | clientUtils.ResponseValue[]>
  try {
    response = await client.getSinglePage({
      url: '/rest/api/3/search',
      queryParams: {
        jql,
        maxResults: '0',
      },
    })
  } catch (e) {
    return true
  }
  if (Array.isArray(response.data) || response.data.total === undefined) {
    return true
  }
  return response.data.total !== 0
}
export const issueTypeSchemeValidator = (
  client: JiraClient,
): ChangeValidator =>
  async (changes, elementSource) => {
    const relevantChanges = getRelevantChanges(changes)
    if (elementSource === undefined || relevantChanges.length === 0) {
      return []
    }
    const idsIterator = awu(await elementSource.list())
    const projects = await awu(idsIterator)
      .filter(id => id.typeName === PROJECT_TYPE)
      .filter(id => id.idType === 'instance')
      .map(id => elementSource.get(id))
      .toArray()
    const issueTypeSchemesToProjects = _.groupBy(
      projects.filter(project => project.value.issueTypeScheme !== undefined),
      project => project.value.issueTypeScheme.elemID.getFullName(),
    )
    const errors = await awu(relevantChanges).map(async change => {
      const removedIssueTypeIds = getRemovedIssueTypeIds(change)
        .map(issueTypeId => issueTypeId.elemID.name)
      const issueTypeScheme = getChangeData(change)
      const linkedProjectNames = issueTypeSchemesToProjects[issueTypeScheme.elemID.getFullName()]
        .map(project => project.value.name)
      if (await areIssueTypesUsed(client, removedIssueTypeIds, linkedProjectNames)) {
        return {
          elemID: issueTypeScheme.elemID,
          severity: 'Error' as SeverityLevel,
          message: 'Issue type is used in a project',
          detailedMessage: `The issue type ${removedIssueTypeIds.join(', ')} is used in the following projects: ${linkedProjectNames.join(', ')}`,
        }
      }
      return undefined
    }).filter(isDefined).toArray()
    return errors
  }
