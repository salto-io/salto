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
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Change, ChangeDataType, ChangeValidator, ElemID, getChangeData, InstanceElement, isInstanceChange, isModificationChange, ModificationChange, ReadOnlyElementsSource, ReferenceExpression } from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { WORKFLOW_SCHEME_TYPE_NAME, WORKFLOW_TYPE_NAME, PROJECT_TYPE } from '../constants'

const { awu } = collections.asynciterable
const { isDefined } = values

type WorkflowSchemeItem = {
    workflow: ReferenceExpression
    issueType: ReferenceExpression
}

type StatusMigration = {
  issueTypeId: ReferenceExpression
  statusId: ReferenceExpression
  newStatusId?: ReferenceExpression
}

const getRelevantChanges = (
  changes: ReadonlyArray<Change<ChangeDataType>>
): ModificationChange<InstanceElement>[] =>
  changes
    .filter(isInstanceChange)
    .filter(isModificationChange)
    .filter(change => getChangeData(change).elemID.typeName === WORKFLOW_SCHEME_TYPE_NAME)


const getWorkflowFromId = (workflowId: ElemID, workflows: InstanceElement[]): InstanceElement => {
  const workflow = workflows.find(instance => instance.elemID.isEqual(workflowId))
  if (workflow === undefined) {
    throw new Error('workflow is undefined')
  }
  return workflow
}

const getDefaultWorkflowItems = (
  workflowScheme: InstanceElement,
  workflows: InstanceElement[],
  defaultIssueTypes: ElemID[]
): StatusMigration[] => {
  const defaultWorkflow = workflowScheme.value.defaultWorkflow.elemID
  const defaultWorkflowInstance = getWorkflowFromId(defaultWorkflow, workflows)
  return defaultIssueTypes.flatMap(issueType => defaultWorkflowInstance.value.statuses
    .map((status: {id: ReferenceExpression}) => ({
      issueTypeId: issueType,
      statusId: status.id,
    })))
}

const getAllStatusItems = (workflowScheme: InstanceElement, workflows: InstanceElement[]): StatusMigration[] => {
  const statusItems = workflowScheme.value.items
    .flatMap((item: WorkflowSchemeItem) => getWorkflowFromId(item.workflow.elemID, workflows).value.statuses
      .map((status: {id: ReferenceExpression}) => ({
        issueTypeId: item.issueType,
        statusId: status.id,
      })))
  return statusItems
}

const getAllStatusItemsFromChange = (
  change: ModificationChange<InstanceElement>,
  workflows: InstanceElement[],
  defaultIssueTypes: ElemID[],
): { before: StatusMigration[]; after: StatusMigration[] } => {
  const { before: beforeWorkflowScheme, after: afterWorkflowScheme } = change.data
  const beforeStatusItems = [
    ...getAllStatusItems(beforeWorkflowScheme, workflows),
    ...getDefaultWorkflowItems(beforeWorkflowScheme, workflows, defaultIssueTypes),
  ]
  const afterStatusItems = [
    ...getAllStatusItems(afterWorkflowScheme, workflows),
    ...getDefaultWorkflowItems(afterWorkflowScheme, workflows, defaultIssueTypes),
  ]
  return { before: beforeStatusItems, after: afterStatusItems }
}

const getIssueTypeSchemeForWorkflowSchemeID = async (
  workflowSchemeID: ElemID,
  projects: InstanceElement[],
  elementSource: ReadOnlyElementsSource
): Promise<InstanceElement[]> => {
  const assignedProjects = projects.filter(instance => instance.value.workflowScheme?.elemID.isEqual(workflowSchemeID))
  return awu(assignedProjects)
    .map(project => elementSource.get(project.value.issueTypeScheme.elemID))
    .toArray()
}

const getUniqIssueTypesFromSchemes = (issueTypeSchemes: InstanceElement[]): ElemID[] => {
  const issueTypes = issueTypeSchemes.flatMap(issueTypeScheme => issueTypeScheme.value.issueTypeIds)
  return _.uniqBy(issueTypes, issueType => issueType.elemID.getFullName())
}

const compareMigrationItems = (status1: StatusMigration, status2: StatusMigration): boolean =>
  status1.issueTypeId.elemID.isEqual(status2.issueTypeId.elemID)
  && status1.statusId.elemID.isEqual(status2.statusId.elemID)

const getStatusMigrationsForChange = async (
  change: ModificationChange<InstanceElement>,
  projects: InstanceElement[],
  workflows: InstanceElement[],
  elementSource: ReadOnlyElementsSource
): Promise<StatusMigration[]> => {
  const issueIds = await getIssueTypeSchemeForWorkflowSchemeID(
    getChangeData(change).elemID, projects, elementSource
  )
  if (issueIds === undefined) {
    // maybe log something like, was not able to find issue type scheme for workflow scheme
    return []
  }
  const { before, after } = getAllStatusItemsFromChange(change, workflows, getUniqIssueTypesFromSchemes(issueIds))
  return _.differenceWith(before, after, compareMigrationItems)
}

export const workflowSchemeMigrationValidator: ChangeValidator = async (changes, elementSource) => {
  if (elementSource === undefined) {
    return []
  }
  const relevantChanges = getRelevantChanges(changes)

  const ids = await awu(await elementSource.list()).toArray()

  const workflows = await awu(ids)
    .filter(id => id.typeName === WORKFLOW_TYPE_NAME)
    .filter(id => id.idType === 'instance')
    .map(id => elementSource.get(id))
    .toArray()
  const projects = await awu(ids)
    .filter(id => id.typeName === PROJECT_TYPE)
    .filter(id => id.idType === 'instance')
    .map(id => elementSource.get(id))
    .toArray()
  const bla2 = await awu(relevantChanges).map(
    async change => getStatusMigrationsForChange(change, projects, workflows, elementSource)
  ).filter(isDefined).toArray()
  // eslint-disable-next-line no-console
  console.log(bla2)
  return []
}
