/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Change,
  ChangeDataType,
  ChangeError,
  ChangeValidator,
  CORE_ANNOTATIONS,
  getChangeData,
  InstanceElement,
  isInstanceChange,
  isInstanceElement,
  isModificationChange,
  isReferenceExpression,
  ModificationChange,
  ReadOnlyElementsSource,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { values, collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import Joi from 'joi'
import { client as clientUtils, filters } from '@salto-io/adapter-components'
import os from 'os'
import { createSchemeGuard, getInstancesFromElementSource, validateReferenceExpression } from '@salto-io/adapter-utils'
import { updateSchemeId } from '../filters/workflow_scheme'
import JiraClient from '../client/client'
import { JiraConfig } from '../config/config'
import { PROJECT_TYPE, WORKFLOW_SCHEME_TYPE_NAME } from '../constants'
import { doesProjectHaveIssues } from './projects/project_deletion'
import { isWorkflowV2Instance } from '../filters/workflowV2/types'

const { addUrlToInstance, configDefToInstanceFetchApiDefinitionsForServiceUrl } = filters
const { awu } = collections.asynciterable
const { isDefined } = values

type WorkflowSchemeItem = {
  workflow: ReferenceExpression
  issueType: ReferenceExpression
}

const WORKFLOW_SCHEME_ITEM_SCHEMA = Joi.object({
  workflow: Joi.custom(validateReferenceExpression('workflow')).required(),
  issueType: Joi.custom(validateReferenceExpression('issueType')).required(),
}).required()

export const isWorkflowSchemeItem = createSchemeGuard<WorkflowSchemeItem>(WORKFLOW_SCHEME_ITEM_SCHEMA)

type ChangedItem = {
  before: ReferenceExpression
  after: ReferenceExpression
  issueType: ReferenceExpression
}

export type StatusMigration = {
  issueTypeId: ReferenceExpression
  statusId: ReferenceExpression
  newStatusId?: ReferenceExpression
}

export const projectHasWorkflowSchemeReference = (project: InstanceElement): boolean =>
  project.value.workflowScheme instanceof ReferenceExpression

const workflowLinkedToProjectWithIssues = async (
  assignedProjects: InstanceElement[],
  client: JiraClient,
): Promise<boolean> => awu(assignedProjects).some(async project => doesProjectHaveIssues(project, client))

export const getRelevantChanges = (
  changes: ReadonlyArray<Change<ChangeDataType>>,
): ModificationChange<InstanceElement>[] =>
  changes
    .filter(isInstanceChange)
    .filter(isModificationChange)
    .filter(change => getChangeData(change).elemID.typeName === WORKFLOW_SCHEME_TYPE_NAME)

const isItemEquals = (item1: WorkflowSchemeItem, item2: WorkflowSchemeItem): boolean =>
  item1.issueType.elemID.isEqual(item2.issueType.elemID)

const isItemModified = (item1: WorkflowSchemeItem, item2: WorkflowSchemeItem): boolean =>
  item1.issueType.elemID.isEqual(item2.issueType.elemID) && !item1.workflow.elemID.isEqual(item2.workflow.elemID)

const getAllIssueTypesForWorkflowScheme = async (
  elementSource: ReadOnlyElementsSource,
  assignedProjects: InstanceElement[],
): Promise<ReferenceExpression[]> => {
  const issueTypeSchemes: InstanceElement[] = await awu(assignedProjects)
    .map(instance => instance.value.issueTypeScheme)
    .filter(isReferenceExpression)
    .map(ref => ref.getResolvedValue(elementSource))
    .filter(isDefined)
    .filter(isInstanceElement)
    .toArray()
  const issueTypes: ReferenceExpression[] = issueTypeSchemes
    .filter(issueTypeScheme => Array.isArray(issueTypeScheme.value.issueTypeIds))
    .flatMap(issueTypeScheme => issueTypeScheme.value.issueTypeIds)
    .filter(isReferenceExpression)
  return _.uniqBy(issueTypes, issueType => issueType.elemID.getFullName())
}

const getDefaultWorkflowIssueTypes = (
  workflowScheme: InstanceElement,
  assignedIssueTypes: ReferenceExpression[],
): ReferenceExpression[] => {
  workflowScheme.value.items
    ?.filter(isWorkflowSchemeItem)
    .forEach((item: WorkflowSchemeItem) =>
      _.remove(assignedIssueTypes, issueType => issueType.elemID.isEqual(item.issueType.elemID)),
    )
  return assignedIssueTypes
}

const getChangedItemsFromChange = async (
  change: ModificationChange<InstanceElement>,
  assignedProjects: InstanceElement[],
  elementSource: ReadOnlyElementsSource,
): Promise<ChangedItem[]> => {
  const { before, after } = change.data
  const beforeItems = (before.value.items ?? []).filter(isWorkflowSchemeItem)
  const afterItems = (after.value.items ?? []).filter(isWorkflowSchemeItem)
  const assignedIssueTypes = await getAllIssueTypesForWorkflowScheme(elementSource, assignedProjects)
  const defaultWorkflowIssueTypes = !before.value.defaultWorkflow.elemID.isEqual(after.value.defaultWorkflow.elemID)
    ? getDefaultWorkflowIssueTypes(after, assignedIssueTypes)
    : []
  const changedDefaultWorkflowItems = defaultWorkflowIssueTypes.map(issueType => ({
    before: before.value.defaultWorkflow,
    after: after.value.defaultWorkflow,
    issueType,
  }))
  const removedItems = _.differenceWith(beforeItems, afterItems, isItemEquals).map((item: WorkflowSchemeItem) => ({
    before: item.workflow,
    after: after.value.defaultWorkflow,
    issueType: item.issueType,
  }))
  const addedItems = _.differenceWith(afterItems, beforeItems, isItemEquals).map(item => ({
    before: before.value.defaultWorkflow,
    after: item.workflow,
    issueType: item.issueType,
  }))
  const afterItemsIssueTypes = _.keyBy(afterItems, item => item.issueType.elemID.getFullName())
  const modifiedItems = beforeItems
    .map((beforeItem: WorkflowSchemeItem) => {
      const afterItem: WorkflowSchemeItem = afterItemsIssueTypes[beforeItem.issueType.elemID.getFullName()]
      if (afterItem === undefined || !isItemModified(beforeItem, afterItem)) {
        return undefined
      }
      return {
        before: beforeItem.workflow,
        after: afterItem.workflow,
        issueType: beforeItem.issueType,
      }
    })
    .filter(isDefined)
  const changedItems = [...addedItems, ...removedItems, ...modifiedItems, ...changedDefaultWorkflowItems]
  return (
    changedItems
      // Might happen if the user changed default workflow.
      .filter(item => !item.before.elemID.isEqual(item.after.elemID))
      .filter(item => assignedIssueTypes.some(issueType => issueType.elemID.isEqual(item.issueType.elemID)))
      // Might happen on unresolved reference to new/old workflow.
      .filter(item => isInstanceElement(item.before.value) && isInstanceElement(item.after.value))
  )
}

const areStatusesEquals = (status1: ReferenceExpression, status2: ReferenceExpression): boolean =>
  status1.elemID.isEqual(status2.elemID)

const getMissingStatuses = (before: InstanceElement, after: InstanceElement): ReferenceExpression[] => {
  const beforeStatuses = isWorkflowV2Instance(before)
    ? before.value.statuses.map(status => status.statusReference)
    : (before.value.statuses ?? []).map((status: { id: ReferenceExpression }) => status.id)
  const afterStatuses = isWorkflowV2Instance(after)
    ? after.value.statuses.map(status => status.statusReference)
    : (after.value.statuses ?? []).map((status: { id: ReferenceExpression }) => status.id)
  return _.differenceWith(beforeStatuses, afterStatuses, areStatusesEquals)
}

const getMigrationForChangedItem = (changedItem: ChangedItem): StatusMigration[] => {
  const { before, after, issueType } = changedItem
  const missingStatuses = getMissingStatuses(before.value, after.value)
  return missingStatuses.map((status: ReferenceExpression) => ({
    issueTypeId: issueType,
    statusId: status,
  }))
}

const formatStatusMigration = (statusMigration: StatusMigration): string => {
  const { issueTypeId, statusId, newStatusId } = statusMigration
  return `{
    issueTypeId = ${issueTypeId.elemID.getFullName()}
    statusId = ${statusId.elemID.getFullName()}
    newStatusId = ${newStatusId ? newStatusId.elemID.getFullName() : 'jira.Status.instance.<NEW_STATUS>'}
  }`
}

const formatStatusMigrations = (statusMigrations: StatusMigration[]): string => {
  const formattedStatusMigrations = statusMigrations.map(formatStatusMigration)
  return `statusMigrations = [
  ${formattedStatusMigrations.join(`,${os.EOL}  `)},
]`
}
export const isSameStatusMigration = (statusMigration1: StatusMigration, statusMigration2: StatusMigration): boolean =>
  statusMigration1.issueTypeId.elemID.isEqual(statusMigration2.issueTypeId.elemID) &&
  statusMigration1.statusId.elemID.isEqual(statusMigration2.statusId.elemID)

const getErrorMessageForStatusMigration = (
  instance: InstanceElement,
  statusMigrations: StatusMigration[],
): ChangeError | undefined => {
  const serviceUrl = instance.annotations[CORE_ANNOTATIONS.SERVICE_URL]
  return statusMigrations.length > 0
    ? {
        elemID: instance.elemID,
        severity: 'Warning',
        message: 'Workflow scheme change requires issue migration',
        detailedMessage: `This workflow scheme change requires an issue migration, as some issue statuses do not exist in the new workflow. If you continue with the deployment, the changes will be pushed as a workflow scheme draft but will not be published. You will have to publish them manually from Jira. Alternatively, you can add the following NACL code to this workflow’s scheme code. Make sure to specific, for each issue type and status, what should its new status be. Learn more at https://help.salto.io/en/articles/6948228-migrating-issues-when-modifying-workflow-schemes .\n${formatStatusMigrations(statusMigrations)}`,
        deployActions: {
          postAction: serviceUrl
            ? {
                title: 'Finalize workflow scheme change',
                description: `Salto pushed the ${instance.elemID.name} workflow scheme changes, but did not publish it. Please follow these steps to complete this change and migrate affected issues`,
                showOnFailure: false,
                subActions: [`Go to ${serviceUrl}`, 'Click on "Publish"', 'Migrate issues as instructed'],
              }
            : undefined,
        },
      }
    : undefined
}

export const workflowSchemeMigrationValidator =
  (client: JiraClient, config: JiraConfig, paginator: clientUtils.Paginator): ChangeValidator =>
  async (changes, elementSource) => {
    const relevantChanges = getRelevantChanges(changes)
    if (elementSource === undefined || relevantChanges.length === 0) {
      return []
    }
    const projects = await getInstancesFromElementSource(elementSource, [PROJECT_TYPE])
    const workflowSchemesToProjects = _.groupBy(projects.filter(projectHasWorkflowSchemeReference), project =>
      project.value.workflowScheme.elemID.getFullName(),
    )
    const activeWorkflowsChanges = await awu(relevantChanges)
      .filter(change => workflowSchemesToProjects[getChangeData(change).elemID.getFullName()] !== undefined)
      .filter(async change =>
        workflowLinkedToProjectWithIssues(
          workflowSchemesToProjects[getChangeData(change).elemID.getFullName()],
          client,
        ),
      )
      .toArray()
    const errors = await awu(activeWorkflowsChanges)
      .map(async change => {
        await updateSchemeId(change, client, paginator, config)
        const instance = getChangeData(change)
        addUrlToInstance(
          instance,
          configDefToInstanceFetchApiDefinitionsForServiceUrl(
            config.apiDefinitions.types[instance.elemID.typeName],
            client.baseUrl,
          ),
        )
        const changedItems = await getChangedItemsFromChange(
          change,
          workflowSchemesToProjects[getChangeData(change).elemID.getFullName()],
          elementSource,
        )
        const statusMigrations = changedItems.flatMap(changedItem => getMigrationForChangedItem(changedItem))
        const existingStatusMigrations: StatusMigration[] = instance.value.statusMigrations ?? []
        const newStatusMigrations = _.differenceWith(statusMigrations, existingStatusMigrations, isSameStatusMigration)
        if (newStatusMigrations.length === 0) {
          return undefined
        }
        return getErrorMessageForStatusMigration(instance, [...existingStatusMigrations, ...newStatusMigrations])
      })
      .filter(isDefined)
      .toArray()
    return errors
  }
