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

const projectWorkflowSchemeChanged = (change : ModificationChange<InstanceElement>): boolean =>
  change.data.before.value.workflowScheme instanceof ReferenceExpression
  && change.data.after.value.workflowScheme instanceof ReferenceExpression
  && !change.data.before.value.workflowScheme.elemID.isEqual(change.data.after.value.workflowScheme.elemID)

const getRelevantChanges = async (
  changes: ReadonlyArray<Change<ChangeDataType>>, client: JiraClient,
): Promise<ModificationChange<InstanceElement>[]> =>
  awu(changes)
    .filter(isInstanceChange)
    .filter(isModificationChange)
    .filter(change => getChangeData(change).elemID.typeName === PROJECT_TYPE)
    .filter(projectWorkflowSchemeChanged)
    .filter(async change => doesProjectHaveIssues(getChangeData(change), client))
    .toArray()

const getChangeErrorForChange = (change: ModificationChange<InstanceElement>): ChangeError =>
  ({
    elemID: getChangeData(change).elemID,
    severity: 'Error',
    message: 'Can’t change workflow scheme of project with issues',
    detailedMessage: 'This project has issues and can’t change workflow scheme',
  })

export const activeWorkflowSchemeChangeValidator = (
  client: JiraClient,
): ChangeValidator =>
  async changes => {
    const relevantChanges = await getRelevantChanges(changes, client)
    return relevantChanges.map(getChangeErrorForChange)
  }
