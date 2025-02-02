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
import { createSchemeGuard, getInstancesFromElementSource, WALK_NEXT_STEP, walkOnValue } from '@salto-io/adapter-utils'
import Joi from 'joi'
import { ISSUE_TYPE_FIELD, PROJECT_FIELD } from '@atlassianlabs/jql-ast'
import _ from 'lodash'
import { AUTOMATION_TYPE, PROJECT_TYPE } from '../../constants'

type IssueTypeObject = {
  fieldType: string
  value: ReferenceExpression
}

type IssueTypeError = {
  componentElemID: ElemID
  invalidIssueType: string | undefined
}

type ProjectWithIssueTypeScheme = InstanceElement & { value: { issueTypeScheme: ReferenceExpression } }

const AUTOMATION_ISSUE_TYPE_OBJECT_SCHEME = Joi.object({
  fieldType: Joi.string().required(),
  value: Joi.object({
    type: Joi.string().required(),
    value: Joi.object().required(),
  })
    .unknown(true)
    .required(),
})
  .unknown(true)
  .required()

const isIssueTypeObject = createSchemeGuard<IssueTypeObject>(AUTOMATION_ISSUE_TYPE_OBJECT_SCHEME)

const getIssueCreateActionProject = (
  value: Values,
  instanceProject: ReferenceExpression | string | undefined,
): string | undefined => {
  if (value.value?.value === 'current') {
    return isReferenceExpression(instanceProject) ? instanceProject.elemID.getFullName() : undefined
  }
  if (isReferenceExpression(value.value?.value)) {
    return value.value.value.elemID.getFullName()
  }
  return undefined
}

const isInstanceWithInvalidIssueType = (
  instance: InstanceElement,
  projectNameToIssueTypeNames: Record<string, string[]>,
): IssueTypeError[] => {
  const invalidIssueTypes: IssueTypeError[] = []
  let projectFullName: string | undefined

  const instanceProject =
    Array.isArray(instance.value.projects) && instance.value.projects.length === 1
      ? instance.value.projects[0].projectId
      : undefined

  walkOnValue({
    elemId: instance.elemID.createNestedID('components'),
    value: instance.value.components,
    func: ({ value, path }) => {
      if (_.isPlainObject(value) && value.fieldType === PROJECT_FIELD) {
        projectFullName = getIssueCreateActionProject(value, instanceProject)
        return WALK_NEXT_STEP.RECURSE
      }

      if (
        isIssueTypeObject(value) &&
        value.fieldType === ISSUE_TYPE_FIELD &&
        isReferenceExpression(value.value.value)
      ) {
        const issueTypeElemID = value.value.value.elemID
        const isValidIssueType = projectFullName
          ? projectNameToIssueTypeNames[projectFullName]?.includes(issueTypeElemID.getFullName())
          : true
        if (!isValidIssueType) {
          invalidIssueTypes.push({ componentElemID: path, invalidIssueType: issueTypeElemID.name })
        }
      }

      return WALK_NEXT_STEP.RECURSE
    },
  })

  return invalidIssueTypes
}

const isIssueCreateActionAutomation = (components: Values[]): boolean =>
  Array.isArray(components) && components.some(component => component.type === 'jira.issue.create')

const isProjectInstanceWithIssueTypeScheme = (instance: InstanceElement): instance is ProjectWithIssueTypeScheme =>
  isReferenceExpression(instance.value.issueTypeScheme)

export const automationIssueTypeValidator: ChangeValidator = async (changes, elementsSource) => {
  if (elementsSource === undefined) {
    return []
  }

  const projects = await getInstancesFromElementSource(elementsSource, [PROJECT_TYPE])
  const projectsWithSchemes = projects.filter(isProjectInstanceWithIssueTypeScheme)
  const projectNameToIssueTypeNames: Record<string, string[]> = Object.fromEntries(
    await Promise.all(
      projectsWithSchemes.map(async project => {
        const issueTypeSchemeElemID = await elementsSource.get(project.value.issueTypeScheme.elemID)
        const resolvedIssueTypeSchemeReferences = issueTypeSchemeElemID?.value.issueTypeIds ?? []

        const issueTypeNames = resolvedIssueTypeSchemeReferences
          .filter(isReferenceExpression)
          .map((issueType: ReferenceExpression) => issueType.elemID.getFullName())

        return [project.elemID.getFullName(), issueTypeNames]
      }),
    ),
  )

  return changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === AUTOMATION_TYPE)
    .filter(instance => isIssueCreateActionAutomation(instance.value.components))
    .flatMap(instance => isInstanceWithInvalidIssueType(instance, projectNameToIssueTypeNames))
    .map(IssueTypeError => ({
      elemID: IssueTypeError.componentElemID,
      severity: 'Error' as SeverityLevel,
      message: 'Cannot deploy automation due to issue types not aligned with the relevant project type issue scheme.',
      detailedMessage: `In order to deploy an automation you must use issue types from the relevant project issue scheme. To fix it, change this issue type: ${IssueTypeError.invalidIssueType}`,
    }))
}
