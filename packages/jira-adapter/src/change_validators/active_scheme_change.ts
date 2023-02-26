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
import { Change, ChangeDataType, ChangeError, ChangeValidator, getChangeData, InstanceElement, isInstanceChange, isModificationChange, ModificationChange, ReferenceExpression } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import JiraClient from '../client/client'
import { PROJECT_TYPE } from '../constants'
import { doesProjectHaveIssues } from './project_deletion'

const { awu } = collections.asynciterable

const RELEVANT_FIELDS = ['priorityScheme', 'workflowScheme', 'issueTypeScheme']
type RelevantField = typeof RELEVANT_FIELDS[number]
const FIELD_FORMATS: Record<RelevantField, string> = {
  priorityScheme: 'priority scheme',
  workflowScheme: 'workflow scheme',
  issueTypeScheme: 'issue type scheme',
}

const projectSchemeChanged = (change : ModificationChange<InstanceElement>): RelevantField[] => {
  const { before, after } = change.data
  const changedFields = RELEVANT_FIELDS
    .filter(field => before.value[field] instanceof ReferenceExpression
      && after.value[field] instanceof ReferenceExpression)
    .filter(type => !before.value[type].elemID.isEqual(after.value[type].elemID))
  return changedFields
}

const getRelevantChanges = async (
  changes: ReadonlyArray<Change<ChangeDataType>>, client: JiraClient,
): Promise<ModificationChange<InstanceElement>[]> =>
  awu(changes)
    .filter(isInstanceChange)
    .filter(isModificationChange)
    .filter(change => getChangeData(change).elemID.typeName === PROJECT_TYPE)
    .filter(change => projectSchemeChanged(change).length > 0)
    .filter(async change => doesProjectHaveIssues(getChangeData(change), client))
    .toArray()

const getChangeErrorForChange = (change: ModificationChange<InstanceElement>): ChangeError[] => {
  const changedFields = projectSchemeChanged(change)
  return changedFields.map(field => ({
    elemID: getChangeData(change).elemID,
    severity: 'Error',
    message: `Can’t replace non-empty project ${FIELD_FORMATS[field]}`,
    detailedMessage: `Salto cannot change ${FIELD_FORMATS[field]} for a project with existing issues. To perform this action manually, you can use the Jira interface. This will allow you to migrate the necessary issues.`,
  }))
}

export const activeSchemeChangeValidator = (
  client: JiraClient,
): ChangeValidator =>
  async changes => {
    const relevantChanges = await getRelevantChanges(changes, client)
    return relevantChanges.flatMap(getChangeErrorForChange)
  }
