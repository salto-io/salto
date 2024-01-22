/*
*                      Copyright 2024 Salto Labs Ltd.
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
import _ from 'lodash'
import Joi from 'joi'
import { collections } from '@salto-io/lowerdash'
import { Change, ChangeDataType, ChangeValidator, InstanceElement, ModificationChange, ReadOnlyElementsSource, ReferenceExpression, SeverityLevel, Value, getChangeData, isInstanceChange, isInstanceElement, isModificationChange, isReferenceExpression } from '@salto-io/adapter-api'
import { createSchemeGuard, getInstancesFromElementSource } from '@salto-io/adapter-utils'
import { WorkflowSchemeItem, isWorkflowSchemeItem, projectHasWorkflowSchemeReference } from '../workflow_scheme_migration'
import { ISSUE_TYPE_NAME, JIRA_WORKFLOW_TYPE, PROJECT_TYPE } from '../../constants'

const { awu } = collections.asynciterable

type StatusMigration = {
  oldStatusReference: ReferenceExpression
  newStatusReference: ReferenceExpression
}

type StatusMapping = {
  issueTypeId: ReferenceExpression
  projectId: ReferenceExpression
  statusMigrations: StatusMigration[]
}

const ISSUE_MAPPINGS_SCHEMA = Joi.array().items(Joi.object({
  issueTypeId: Joi.object().required(),
  projectId: Joi.object().required(),
  statusMigrations: Joi.array().items(Joi.object({
    oldStatusReference: Joi.object().required(),
    newStatusReference: Joi.object().required(),
  })).required(),
})).required()

const isStatusMappingsSchemeGuard = createSchemeGuard<StatusMapping[]>(ISSUE_MAPPINGS_SCHEMA, 'received invalid statusMappings')

const isStatusMappings = (statusMappings: unknown): statusMappings is StatusMapping[] =>
  isStatusMappingsSchemeGuard(statusMappings)
  && statusMappings.every(statusMapping =>
    isReferenceExpression(statusMapping.issueTypeId)
    && isReferenceExpression(statusMapping.projectId)
    && statusMapping.statusMigrations.every(
      statusMigration =>
        isReferenceExpression(statusMigration.oldStatusReference)
        && isReferenceExpression(statusMigration.newStatusReference)
    ))


const isSameOldStatusReference = (statusMigration1: StatusMigration, statusMigration2: StatusMigration): boolean =>
  statusMigration1.oldStatusReference.elemID.isEqual(statusMigration2.oldStatusReference.elemID)

const isSameStatusMappings = (
  statusMapping1: StatusMapping,
  statusMapping2: StatusMapping,
): boolean =>
  statusMapping1.issueTypeId.elemID.isEqual(statusMapping2.issueTypeId.elemID)
    && statusMapping1.projectId.elemID.isEqual(statusMapping2.projectId.elemID)
    && _.isEmpty(_.differenceWith(
      statusMapping1.statusMigrations,
      statusMapping2.statusMigrations,
      isSameOldStatusReference
    ))

const getRelevantChanges = (
  changes: ReadonlyArray<Change<ChangeDataType>>
): ModificationChange<InstanceElement>[] =>
  changes
    .filter(isInstanceChange)
    .filter(isModificationChange)
    .filter(change => getChangeData(change).elemID.typeName === JIRA_WORKFLOW_TYPE)

const getRemovedStatuses = (change: ModificationChange<InstanceElement>): ReferenceExpression[] => {
  const beforeStatuses = (change.data.before.value.statuses ?? [])
    .map((status: Value) => status.statusReference)
    .filter(isReferenceExpression)
  const afterStatuses = (change.data.after.value.statuses ?? [])
    .map((status: Value) => status.statusReference)
    .filter(isReferenceExpression)
  return _.differenceWith(
    beforeStatuses,
    afterStatuses,
    (status1: Value, status2: Value) => status1.elemID.isEqual(status2.elemID)
  )
}

const isInstanceWithName = (instance: InstanceElement): instance is InstanceElement & { name: string } =>
  typeof instance.value?.name === 'string'

const getWorkflowSchemeMigrationIssueType = async ({
  workflowSchemeInstance,
  workflowName,
  elementsSource,
}: {
  workflowSchemeInstance: InstanceElement
  workflowName: string
  elementsSource: ReadOnlyElementsSource
}): Promise<ReferenceExpression[]> => {
  const workflowSchemeDefaultWorkflow = workflowSchemeInstance.value.defaultWorkflow
  if (workflowSchemeDefaultWorkflow.elemID.name === workflowName) {
    // all the issueTypes
    const issueTypes = (await getInstancesFromElementSource(elementsSource, [ISSUE_TYPE_NAME]))
      .filter(isInstanceWithName)
      .map(instance => new ReferenceExpression(instance.elemID, instance))
    // issueTypes that not using the default workflow
    const notUsingDefaultIssueTypes = workflowSchemeInstance.value.items
      .filter(isWorkflowSchemeItem)
      .map((item: WorkflowSchemeItem) => item.issueType)
      .filter(isReferenceExpression)
    return _.difference(issueTypes, notUsingDefaultIssueTypes)
  }
  const issueTypes = workflowSchemeInstance.value.items
    .filter(isWorkflowSchemeItem)
    .filter((item: WorkflowSchemeItem) => item.workflow.elemID.name === workflowName)
    .map((item: WorkflowSchemeItem) => item.issueType)
  return issueTypes
}

const createStatusMapping = ({
  project,
  issueType,
  statusesToMigrate,
} : {
  project: ReferenceExpression
  issueType: ReferenceExpression
  statusesToMigrate: ReferenceExpression[]
}): StatusMapping => ({
  issueTypeId: issueType,
  projectId: project,
  statusMigrations: statusesToMigrate.map(status => ({
    oldStatusReference: status,
    // Hack in order to keep the type strict - the user should fill it in
    newStatusReference: status,
  })),
})

const createStatusMigrationStructure = (statusMigration: StatusMigration): string =>
  `{
      oldStatusReference = ${statusMigration.oldStatusReference.elemID.getFullName()}
      newStatusReference = jira.Status.instance.<statusName>
    }`


const createStatusMappingStructure = (statusMappings: StatusMapping): string => `{
      issueTypeId = ${statusMappings.issueTypeId.elemID.getFullName()}
      projectId = ${statusMappings.projectId.elemID.getFullName()}
      statusMigrations = [
        ${statusMappings.statusMigrations.map(createStatusMigrationStructure).join(',\n')}]\n},`

const getNewStatusMappings = async ({
  workflowSchemeInstance,
  workflowName,
  removedStatuses,
  projectReferences,
  existingStatusMappings,
  elementsSource,
}: {
  workflowSchemeInstance: InstanceElement
  workflowName: string
  removedStatuses: ReferenceExpression[]
  projectReferences: ReferenceExpression[]
  existingStatusMappings: StatusMapping[]
  elementsSource: ReadOnlyElementsSource
}): Promise<StatusMapping[]> => {
  const issueTypeReferences = await getWorkflowSchemeMigrationIssueType({
    workflowSchemeInstance,
    workflowName,
    elementsSource,
  })
  if (_.isEmpty(issueTypeReferences)) {
    return []
  }
  const statusMappings = projectReferences.flatMap(project =>
    issueTypeReferences.map(issueType =>
      createStatusMapping({
        project,
        issueType,
        statusesToMigrate: removedStatuses,
      })))
  const newStatusMappings = _.differenceWith(statusMappings, existingStatusMappings, isSameStatusMappings)
  if (_.isEmpty(newStatusMappings)) {
    return []
  }
  return statusMappings
}

export const workflowStatusMappingsValidator: ChangeValidator = async (changes, elementsSource) => {
  const relevantChanges = getRelevantChanges(changes)
  if (elementsSource === undefined || _.isEmpty(relevantChanges)) {
    return []
  }
  const projects = await getInstancesFromElementSource(elementsSource, [PROJECT_TYPE])
  // all the active workflowSchemes
  const workflowSchemeNameToInstance = await awu(projects)
    .map(project => project.value.workflowScheme)
    .filter(isReferenceExpression)
    .map(async ref => ref.getResolvedValue(elementsSource))
    .filter(isInstanceElement)
    .keyBy(instance => instance.elemID.getFullName())

  const workflowSchemeNameToProjectReferences = _.groupBy(
    projects.filter(projectHasWorkflowSchemeReference)
      .map(project => new ReferenceExpression(project.elemID, project)),
    project => project.value.value.workflowScheme.elemID.getFullName(),
  )
  return awu(relevantChanges).flatMap(async change => {
    const workflowInstance = getChangeData(change)
    const existingStatusMappings = isStatusMappings(workflowInstance.value.statusMappings)
      ? workflowInstance.value.statusMappings
      : []
    const removedStatuses = getRemovedStatuses(change)
    if (_.isEmpty(removedStatuses)) {
      return []
    }
    const newStatusMappings = await awu(Object.entries(workflowSchemeNameToProjectReferences))
      .flatMap(async ([workflowSchemeName, projectReferences]) =>
        getNewStatusMappings({
          workflowSchemeInstance: workflowSchemeNameToInstance[workflowSchemeName],
          workflowName: change.data.after.value.name,
          removedStatuses,
          projectReferences,
          existingStatusMappings,
          elementsSource,
        }))
      .toArray()
    if (_.isEmpty(newStatusMappings)) {
      return []
    }
    const statusMappingsFormat = `statusMappings = [\n${newStatusMappings.map(statusMapping => createStatusMappingStructure(statusMapping)).join('\n')}\n]`
    return [{
      elemID: change.data.after.elemID,
      severity: 'Error' as SeverityLevel,
      message: 'Workflow change requires status migration',
      detailedMessage: `This workflow change requires a status migration, as some statuses do not exist in the new workflow. In order to resume you can add the following NACL code to this workflow’s code. Make sure to specific, for each project, issue type and status, what should its new status be. Learn more at https://help.salto.io/en/articles/6948228-migrating-issues-when-modifying-workflow-schemes .\n${statusMappingsFormat}`,
    }]
  }).toArray()
}
