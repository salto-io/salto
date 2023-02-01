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
import { Change, ChangeDataType, ChangeError, ChangeValidator, CORE_ANNOTATIONS, getChangeData, InstanceElement, isInstanceChange, isModificationChange, ModificationChange, ReadOnlyElementsSource, ReferenceExpression } from '@salto-io/adapter-api'
import { values, collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { PROJECT_TYPE, WORKFLOW_SCHEME_TYPE_NAME } from '../constants'

const { awu } = collections.asynciterable
const { isDefined } = values

type WorkflowSchemeItem = {
    workflow: ReferenceExpression
    issueType: ReferenceExpression
}

type ChangedItem = {
  before: ReferenceExpression
  after: ReferenceExpression
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

const isItemEquals = (item1: WorkflowSchemeItem, item2: WorkflowSchemeItem): boolean =>
  item1.issueType.elemID.isEqual(item2.issueType.elemID)

const isItemModified = (item1: WorkflowSchemeItem, item2: WorkflowSchemeItem): boolean =>
  item1.issueType.elemID.isEqual(item2.issueType.elemID) && !item1.workflow.elemID.isEqual(item2.workflow.elemID)

const getDefaultWorkflowIssueTypes = async (
  elementSource: ReadOnlyElementsSource,
  workflowScheme: InstanceElement,
  projects: InstanceElement[]
): Promise<ReferenceExpression[]> => {
  const assignedProjects = projects.filter(instance =>
        instance.value.workflowScheme?.elemID.isEqual(workflowScheme.elemID))
  const issueTypeSchemes = await awu(assignedProjects)
    .map(instance => instance.value.issueTypeScheme)
    .map((ref: ReferenceExpression) => elementSource.get(ref.elemID))
    .toArray()
  const issueTypes = issueTypeSchemes.flatMap(issueTypeScheme => issueTypeScheme.value.issueTypeIds)
  const assignedIssueTypes = _.uniqBy(issueTypes, (issueType: ReferenceExpression) => issueType.elemID.getFullName())
  workflowScheme.value.items
    .forEach((item: WorkflowSchemeItem) =>
      _.remove(assignedIssueTypes, issueType => issueType.elemID.isEqual(item.issueType.elemID)))
  return assignedIssueTypes
}

const getChangedItemsFromChange = async (
  change: ModificationChange<InstanceElement>,
  projects: InstanceElement[],
  elementSource: ReadOnlyElementsSource,
): Promise<ChangedItem[]> => {
  const { before, after } = change.data
  const defaultWorkflowIssueTypes = !before.value.defaultWorkflow.elemID.isEqual(after.value.defaultWorkflow.elemID)
    ? await getDefaultWorkflowIssueTypes(elementSource, after, projects) : []
  const changedDefaultWorkflowItems = defaultWorkflowIssueTypes.map(issueType => ({
    before: before.value.defaultWorkflow,
    after: after.value.defaultWorkflow,
    issueType,
  }))
  const removedItems = _.differenceWith(before.value.items, after.value.items, isItemEquals).map(item => ({
    before: item.workflow,
    after: after.value.defaultWorkflow,
    issueType: item.issueType,
  }))
  const addedItems = _.differenceWith(after.value.items, before.value.items, isItemEquals).map(item => ({
    before: before.value.defaultWorkflow,
    after: item.workflow,
    issueType: item.issueType,
  }))
  const modifiedItems = before.value.items.map((beforeItem: WorkflowSchemeItem) => {
    const afterItem = after.value.items.find((item: WorkflowSchemeItem) => isItemModified(beforeItem, item))
    if (afterItem === undefined) {
      return undefined
    }
    return {
      before: beforeItem.workflow,
      after: afterItem.workflow,
      issueType: beforeItem.issueType,
    }
  }).filter(isDefined)
  return [
    ...addedItems,
    ...removedItems,
    ...modifiedItems,
    ...changedDefaultWorkflowItems,
  ]
}

const areStatusesEquals = (status1: ReferenceExpression, status2: ReferenceExpression): boolean =>
  status1.elemID.isEqual(status2.elemID)

const getMissingStatuses = (before: InstanceElement, after: InstanceElement): ReferenceExpression[] => {
  const beforeStatuses = before.value.statuses.map((status: {id: ReferenceExpression}) => status.id)
  const afterStatuses = after.value.statuses.map((status: {id: ReferenceExpression}) => status.id)
  return _.differenceWith(beforeStatuses, afterStatuses, areStatusesEquals)
}

const getMigrationForChangedItem = (changedItem: ChangedItem): StatusMigration[] => {
  const { before, after, issueType } = changedItem
  const missingStatuses = getMissingStatuses(before.value, after.value)
  const defaultStatus: ReferenceExpression | undefined = after.value.value.statuses[0]?.id
  return missingStatuses.map((status: ReferenceExpression) => ({
    issueTypeId: issueType,
    statusId: status,
    newStatusId: defaultStatus,
  }))
}

const formatStatusMigration = (statusMigration: StatusMigration): string => {
  const { issueTypeId, statusId, newStatusId } = statusMigration
  return `{\n issueTypeId = ${issueTypeId.elemID.getFullName()}\n statusId = ${statusId.elemID.getFullName()}\n newStatusId = ${newStatusId ? newStatusId.elemID.getFullName() : 'jira.Status.instance.<ENTER_STATUS_HERE>'}\n}`
}

const formatStatusMigrations = (statusMigrations: StatusMigration[]): string => {
  const formattedStatusMigrations = statusMigrations.map(formatStatusMigration)
  return `statusMigrations = [\n${formattedStatusMigrations.join(',\n')}\n]`
}

const getErrorMessageForStatusMigration = (
  instance: InstanceElement,
  statusMigrations: StatusMigration[],
): ChangeError | undefined => {
  const { serviceUrl } = instance.annotations[CORE_ANNOTATIONS.SERVICE_URL]
  return statusMigrations.length > 0 ? {
    elemID: instance.elemID,
    severity: 'Warning',
    message: `Deployment of workflow scheme ${instance.elemID.name} will require migrating ${statusMigrations.length === 1 ? 'one status' : `${statusMigrations.length} statuses`}`,
    detailedMessage: '',
    deployActions: {
      preAction: {
        title: `Status migration for workflow scheme ${instance.elemID.name}`,
        description: `Add the following field to migrate statuses in Jira: \n${formatStatusMigrations(statusMigrations)}\n`,
        subActions: [],
      },
      postAction: serviceUrl ? {
        title: `Status migration for workflow scheme ${instance.elemID.name}`,
        description: 'finish the migration in Jira by following the steps below:',
        subActions: [
          `Open workflow scheme page in jira ${serviceUrl}`,
          'Press on publish',
          '???',
          'Click "Submit"',
        ],
      } : undefined,
    },
  } : undefined
}

export const workflowSchemeMigrationValidator: ChangeValidator = async (changes, elementSource) => {
  const relevantChanges = getRelevantChanges(changes)
  if (elementSource === undefined || relevantChanges.length === 0) {
    return []
  }
  const ids = await awu(await elementSource.list()).toArray()
  const projects = await awu(ids)
    .filter(id => id.typeName === PROJECT_TYPE)
    .filter(id => id.idType === 'instance')
    .map(id => elementSource.get(id))
    .toArray()

  const errors = await awu(relevantChanges).map(async change => {
    const instance = getChangeData(change)
    const changedItems = await getChangedItemsFromChange(change, projects, elementSource)
    const statusMigrations = changedItems.flatMap(changedItem => getMigrationForChangedItem(changedItem))
    return getErrorMessageForStatusMigration(instance, statusMigrations)
  }).filter(isDefined).toArray()
  return errors
}
