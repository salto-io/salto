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
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import {
  Change,
  ChangeDataType,
  ChangeValidator,
  InstanceElement,
  ModificationChange,
  ReadOnlyElementsSource,
  ReferenceExpression,
  SeverityLevel,
  getChangeData,
  isInstanceChange,
  isInstanceElement,
  isModificationChange,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { createSchemeGuard, getInstancesFromElementSource, validateReferenceExpression } from '@salto-io/adapter-utils'
import { isWorkflowSchemeItem, projectHasWorkflowSchemeReference } from '../workflow_scheme_migration'
import { ISSUE_TYPE_NAME, WORKFLOW_CONFIGURATION_TYPE, PROJECT_TYPE } from '../../constants'

const { awu } = collections.asynciterable
const { makeArray } = collections.array
const log = logger(module)

type StatusMigration = {
  oldStatusReference: ReferenceExpression
  newStatusReference: ReferenceExpression
}

type StatusMapping = {
  issueTypeId: ReferenceExpression
  projectId: ReferenceExpression
  statusMigrations: StatusMigration[]
}

const STATUS_MAPPINGS_SCHEMA = Joi.array().items(
  Joi.object({
    issueTypeId: Joi.custom(validateReferenceExpression('issueTypeId')).required(),
    projectId: Joi.custom(validateReferenceExpression('projectId')).required(),
    statusMigrations: Joi.array()
      .items(
        Joi.object({
          oldStatusReference: Joi.custom(validateReferenceExpression('oldStatusReference')).required(),
          newStatusReference: Joi.custom(validateReferenceExpression('newStatusReference')).required(),
        }),
      )
      .required(),
  }),
)

const isStatusMappings = createSchemeGuard<StatusMapping[]>(STATUS_MAPPINGS_SCHEMA, 'received invalid statusMappings')

const isSameStatusMappings = (statusMapping1: StatusMapping, statusMapping2: StatusMapping): boolean =>
  statusMapping1.issueTypeId.elemID.isEqual(statusMapping2.issueTypeId.elemID) &&
  statusMapping1.projectId.elemID.isEqual(statusMapping2.projectId.elemID) &&
  _.isEmpty(
    _.differenceBy(statusMapping1.statusMigrations, statusMapping2.statusMigrations, migration =>
      migration.oldStatusReference.elemID.getFullName(),
    ),
  )

const getRelevantChanges = (changes: ReadonlyArray<Change<ChangeDataType>>): ModificationChange<InstanceElement>[] =>
  changes
    .filter(isInstanceChange)
    .filter(isModificationChange)
    .filter(change => getChangeData(change).elemID.typeName === WORKFLOW_CONFIGURATION_TYPE)

const getRemovedStatuses = (change: ModificationChange<InstanceElement>): ReferenceExpression[] => {
  const beforeStatuses = makeArray(change.data.before.value.statuses)
    .map(status => status.statusReference)
    .filter(isReferenceExpression)
  const afterStatuses = makeArray(change.data.after.value.statuses)
    .map(status => status.statusReference)
    .filter(isReferenceExpression)
  return _.differenceBy(beforeStatuses, afterStatuses, status => status.elemID.getFullName())
}

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
  if (
    isReferenceExpression(workflowSchemeDefaultWorkflow) &&
    // when the workflow that has changed is the default workflow of a workflowScheme
    // we need to include the issue types that use the default workflow in this scheme in the status mappings
    workflowSchemeDefaultWorkflow.elemID.name === workflowName
  ) {
    // all the issueTypes
    const issueTypes = (await getInstancesFromElementSource(elementsSource, [ISSUE_TYPE_NAME])).map(
      instance => new ReferenceExpression(instance.elemID, instance),
    )
    // issueTypes that not using the default workflow
    const notUsingDefaultIssueTypes = makeArray(workflowSchemeInstance.value.items)
      .filter(isWorkflowSchemeItem)
      .map(item => item.issueType)
    // the issueTypes that are specified in the workflowScheme items are not using the default workflow,
    // all the rest issueTypes are using the default workflow
    return _.differenceBy(issueTypes, notUsingDefaultIssueTypes, issueType => issueType.elemID.getFullName())
  }
  const issueTypes = makeArray(workflowSchemeInstance.value.items)
    .filter(isWorkflowSchemeItem)
    // the issueTypes that using this workflow in the scheme are the ones that we need to migrate
    .filter(item => item.workflow.elemID.name === workflowName)
    .map(item => item.issueType)
  return issueTypes
}

const createStatusMapping = ({
  project,
  issueType,
  statusesToMigrate,
}: {
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
        },`

const createStatusMappingStructure = (statusMappings: StatusMapping): string =>
  `{
      issueTypeId = ${statusMappings.issueTypeId.elemID.getFullName()}
      projectId = ${statusMappings.projectId.elemID.getFullName()}
      statusMigrations = [
        ${statusMappings.statusMigrations.map(createStatusMigrationStructure).join(`
        `)}
      ]
    },`

const getProjectIssueTypes = async (
  projectRef: ReferenceExpression,
  elementsSource: ReadOnlyElementsSource,
): Promise<ReferenceExpression[]> => {
  const issueTypeSchemaRef = projectRef.value.value.issueTypeScheme
  if (!isReferenceExpression(issueTypeSchemaRef)) {
    log.debug(`issueTypeScheme of the project ${projectRef.elemID.getFullName()} is not a reference expression`)
    return []
  }
  const issueTypeScheme = await issueTypeSchemaRef.getResolvedValue(elementsSource)
  if (!isInstanceElement(issueTypeScheme)) {
    log.debug(`issueTypeScheme of the project ${projectRef.elemID.getFullName()} is not an instance element`)
    return []
  }
  return makeArray(issueTypeScheme.value.issueTypeIds).filter(isReferenceExpression)
}

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
  const statusMappings = await awu(projectReferences)
    .flatMap(async project => {
      const projectIssueTypes = new Set(
        (await getProjectIssueTypes(project, elementsSource)).map(issueType => issueType.elemID.getFullName()),
      )
      return issueTypeReferences
        .filter(issueType => projectIssueTypes.has(issueType.elemID.getFullName()))
        .map(issueType =>
          createStatusMapping({
            project,
            issueType,
            statusesToMigrate: removedStatuses,
          }),
        )
    })
    .toArray()
  const missingStatusMappings = _.differenceWith(statusMappings, existingStatusMappings, isSameStatusMappings)
  if (_.isEmpty(missingStatusMappings)) {
    return []
  }
  return statusMappings
}

const getStatusMappingsFormat = (statusMappings: StatusMapping[]): string =>
  `statusMappings = [
    ${statusMappings.map(statusMapping => createStatusMappingStructure(statusMapping)).join('\n    ')}
]`

export const workflowStatusMappingsValidator: ChangeValidator = async (changes, elementsSource) => {
  const relevantChanges = getRelevantChanges(changes)
  if (elementsSource === undefined || _.isEmpty(relevantChanges)) {
    return []
  }
  const projects = await getInstancesFromElementSource(elementsSource, [PROJECT_TYPE])
  // all the active workflowSchemes
  const workflowSchemeNameToInstance = await awu(projects)
    .filter(projectHasWorkflowSchemeReference)
    .map(project => project.value.workflowScheme.getResolvedValue(elementsSource))
    .filter(isInstanceElement)
    .keyBy(instance => instance.elemID.getFullName())

  const workflowSchemeNameToProjectReferences = _.groupBy(
    projects.filter(projectHasWorkflowSchemeReference).map(project => new ReferenceExpression(project.elemID, project)),
    project => project.value.value.workflowScheme.elemID.getFullName(),
  )
  return awu(relevantChanges)
    .flatMap(async change => {
      const workflowInstance = getChangeData(change)
      if (!isStatusMappings(workflowInstance.value.statusMappings)) {
        const { error } = STATUS_MAPPINGS_SCHEMA.validate(workflowInstance.value.statusMappings)
        return [
          {
            elemID: change.data.after.elemID,
            severity: 'Error' as SeverityLevel,
            message: 'Invalid workflow status mapping',
            detailedMessage: `Error while validating the user-provided status mapping: ${error?.message}. Learn more at https://help.salto.io/en/articles/8851200-migrating-issues-when-modifying-workflows`,
          },
        ]
      }
      const existingStatusMappings = workflowInstance.value.statusMappings ?? []
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
          }),
        )
        .toArray()
      if (_.isEmpty(newStatusMappings)) {
        return []
      }
      return [
        {
          elemID: change.data.after.elemID,
          severity: 'Error' as SeverityLevel,
          message: 'Workflow change requires status migration',
          detailedMessage: `This workflow change requires a status migration, as some statuses do not exist in the new workflow. In order to resume you can add the following NACL code to this workflow’s code. Make sure to specific, for each project, issue type and status, what should its new status be. Learn more at https://help.salto.io/en/articles/8851200-migrating-issues-when-modifying-workflows.\n${getStatusMappingsFormat(newStatusMappings)}`,
        },
      ]
    })
    .toArray()
}
