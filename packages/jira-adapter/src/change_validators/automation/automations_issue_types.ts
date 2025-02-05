/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ChangeValidator,
  ElemID,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceChange,
  isReferenceExpression,
  ReferenceExpression,
  SeverityLevel,
  Values,
} from '@salto-io/adapter-api'
import {
  createSchemeGuard,
  getInstancesFromElementSource,
  isResolvedReferenceExpression,
  WALK_NEXT_STEP,
  walkOnValue,
} from '@salto-io/adapter-utils'
import Joi from 'joi'
import { ISSUE_TYPE_FIELD, PROJECT_FIELD } from '@atlassianlabs/jql-ast'
import _ from 'lodash'
import { AUTOMATION_TYPE, PROJECT_TYPE } from '../../constants'
import JiraClient from '../../client/client'

type OperationValue = {
  type: string
  value: ReferenceExpression | string
}

type OperationObject = {
  fieldType: string
  value: OperationValue
}

type IssueTypeError = {
  componentElemID: ElemID
  invalidIssueType: string
  projectKey: string
}

type ProjectWithIssueTypeScheme = InstanceElement & { value: { issueTypeScheme: ReferenceExpression } }

const AUTOMATION_OPERATION_OBJECT_SCHEME = Joi.object({
  fieldType: Joi.string().required(),
  value: Joi.object({
    type: Joi.string().required(),
    value: Joi.alternatives().try(Joi.object().required(), Joi.string().required()).required(),
  })
    .unknown(true)
    .required(),
})
  .unknown(true)
  .required()

const isOperationObject = createSchemeGuard<OperationObject>(AUTOMATION_OPERATION_OBJECT_SCHEME)

const isProjectInstanceWithIssueTypeScheme = (instance: InstanceElement): instance is ProjectWithIssueTypeScheme =>
  isReferenceExpression(instance.value.issueTypeScheme)

const getIssueCreateActionProject = (
  value: Values,
  instanceProject: ReferenceExpression | string | undefined,
): { projectFullName: string | undefined; projectKey: string | undefined } => {
  if (value.value?.value === 'current') {
    const projectFullName = isReferenceExpression(instanceProject) ? instanceProject.elemID.getFullName() : undefined
    const projectKey =
      projectFullName && isResolvedReferenceExpression(instanceProject) ? instanceProject.value.value.key : undefined
    return { projectFullName, projectKey }
  }
  if (isReferenceExpression(value.value?.value)) {
    const projectFullName = value.value.value.elemID.getFullName()
    const projectKey = isResolvedReferenceExpression(value.value?.value)
      ? value.value?.value.resValue.value.key
      : undefined
    return { projectFullName, projectKey }
  }
  return { projectFullName: undefined, projectKey: undefined }
}

const isInstanceWithInvalidIssueType = (
  instance: InstanceElement,
  projectNameToIssueTypeNames: Record<string, string[]>,
): IssueTypeError[] => {
  const invalidIssueTypes: IssueTypeError[] = []
  const instanceProject =
    Array.isArray(instance.value.projects) && instance.value.projects.length === 1
      ? instance.value.projects[0].projectId
      : undefined

  walkOnValue({
    elemId: instance.elemID.createNestedID('components'),
    value: instance.value.components,
    func: ({ value, path }) => {
      if (_.isPlainObject(value) && value.component === 'ACTION' && value.type === 'jira.issue.create') {
        const operations = Array.isArray(value.value.operations) ? value.value.operations : undefined
        const projectOperation = operations.find(
          (op: unknown): op is OperationObject => isOperationObject(op) && op.fieldType === PROJECT_FIELD,
        )
        const issueTypeOperation = operations.find(
          (op: unknown): op is OperationObject =>
            isOperationObject(op) && op.fieldType === ISSUE_TYPE_FIELD && isReferenceExpression(op.value?.value),
        )
        const { projectFullName, projectKey } = getIssueCreateActionProject(projectOperation, instanceProject)
        const issueTypeElemID = issueTypeOperation ? issueTypeOperation.value.value.elemID : undefined
        const isValidIssueType =
          projectFullName && issueTypeElemID
            ? projectNameToIssueTypeNames[projectFullName]?.includes(issueTypeElemID.getFullName())
            : true

        if (!isValidIssueType && projectKey) {
          invalidIssueTypes.push({ componentElemID: path, invalidIssueType: issueTypeElemID.name, projectKey })
        }
      }
      return WALK_NEXT_STEP.RECURSE
    },
  })

  return invalidIssueTypes
}

/**
 * Verify that for jira.issue.create components, the issue types are selected from the issue type scheme associated with the referenced project.
 */
export const automationIssueTypeValidator: (client: JiraClient) => ChangeValidator =
  client => async (changes, elementsSource) => {
    if (elementsSource === undefined) {
      return []
    }

    const relevantChanges = changes
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === AUTOMATION_TYPE)

    if (_.isEmpty(relevantChanges)) {
      return []
    }

    const projects = await getInstancesFromElementSource(elementsSource, [PROJECT_TYPE])
    const projectsWithSchemes = projects.filter(isProjectInstanceWithIssueTypeScheme)
    const projectNameToIssueTypeNames: Record<string, string[]> = Object.fromEntries(
      await Promise.all(
        projectsWithSchemes.map(async project => {
          const issueTypeSchemeInstance = await elementsSource.get(project.value.issueTypeScheme.elemID)
          const resolvedIssueTypeSchemeReferences = issueTypeSchemeInstance?.value.issueTypeIds ?? []

          const issueTypeNames = resolvedIssueTypeSchemeReferences
            .filter(isReferenceExpression)
            .map((issueType: ReferenceExpression) => issueType.elemID.getFullName())

          return [project.elemID.getFullName(), issueTypeNames]
        }),
      ),
    )

    const { baseUrl } = client

    return relevantChanges
      .flatMap(instance => isInstanceWithInvalidIssueType(instance, projectNameToIssueTypeNames))
      .map(IssueTypeError => {
        const issueTypesSchemeUrl = `${baseUrl}plugins/servlet/project-config/${IssueTypeError.projectKey}/issuetypes`
        return {
          elemID: IssueTypeError.componentElemID,
          severity: 'Error' as SeverityLevel,
          message:
            'Cannot deploy automation due to issue types not aligned with the relevant project issue type scheme.',
          detailedMessage: `In order to deploy an automation you must use issue types from the relevant project issue type scheme. To fix it, change this issue type: ${IssueTypeError.invalidIssueType} to one of the following issue types: ${issueTypesSchemeUrl}`,
        }
      })
  }
