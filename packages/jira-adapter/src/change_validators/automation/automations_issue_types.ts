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
} from '@salto-io/adapter-api'
import { createSchemeGuard, getInstancesFromElementSource, WALK_NEXT_STEP, walkOnValue } from '@salto-io/adapter-utils'
import Joi from 'joi'
import { ISSUE_TYPE_FIELD, PROJECT_FIELD } from '@atlassianlabs/jql-ast'
import { collections } from '@salto-io/lowerdash'
import { AUTOMATION_TYPE, PROJECT_TYPE } from '../../constants'

const { awu } = collections.asynciterable

type Component = {
  component: string
  type: string
}

type IssueTypeObject = {
  fieldType: string
  value: ReferenceExpression
}

const AUTOMATION_ISSUE_TYPE_OBJECT_SCHEME = Joi.object({
  fieldType: Joi.string().required(),
  value: Joi.object({
    type: Joi.string().required(),
    value: Joi.any().required(),
  })
    .unknown(true)
    .required(),
})
  .unknown(true)
  .required()

const isIssueTypeObject = createSchemeGuard<IssueTypeObject>(AUTOMATION_ISSUE_TYPE_OBJECT_SCHEME)

const isInstanceWithInvalidIssueType = (
  instance: InstanceElement,
  projectsIssueTypeSchemes: { key: string; value: string }[],
): { componentElemID: ElemID; invalidIssueType: string | undefined }[] => {
  const invalidIssueTypes: { componentElemID: ElemID; invalidIssueType: string | undefined }[] = []
  let projectKey: string | undefined

  walkOnValue({
    elemId: instance.elemID.createNestedID('components'),
    value: instance.value.components,
    func: ({ value, path }) => {
      if (value.fieldType === PROJECT_FIELD) {
        projectKey = value.value.value.elemID.getFullName()
        return WALK_NEXT_STEP.RECURSE
      }

      if (isIssueTypeObject(value) && value.fieldType === ISSUE_TYPE_FIELD) {
        const issueType = value.value.value !== 'current' ? value.value.value.elemID.getFullName() : undefined

        const isValidIssueType = projectKey
          ? projectsIssueTypeSchemes.some(project => project.key === projectKey && project.value.includes(issueType))
          : false

        if (!isValidIssueType) {
          invalidIssueTypes.push({ componentElemID: path, invalidIssueType: issueType })
        }
      }

      return WALK_NEXT_STEP.RECURSE
    },
  })

  return invalidIssueTypes
}

const isNotGlobalAutomation = (instance: InstanceElement): boolean => 'projects' in instance.value

const isIssueCreateActionAutomation = (instance: InstanceElement): boolean =>
  instance.value.components.some((component: Component) => component.type === 'jira.issue.create')

export const projectHasIssueTypeSchemeReference = (project: InstanceElement): boolean =>
  project.value.issueTypeScheme instanceof ReferenceExpression

export const automationIssueTypeValidator: ChangeValidator = async (changes, elementsSource) => {
  if (elementsSource === undefined) {
    return []
  }

  const projects = await getInstancesFromElementSource(elementsSource, [PROJECT_TYPE])
  const projectsIssueTypeSchemes = await awu(projects)
    .filter(projectHasIssueTypeSchemeReference)
    .map(async project => {
      const resolvedIssueTypeScheme =
        (await (await elementsSource.get(project.value.issueTypeScheme.elemID))?.value.issueTypeIds) ?? []

      return {
        key: project.elemID.getFullName(),
        value: resolvedIssueTypeScheme
          .filter(isReferenceExpression)
          .map((issueType: ReferenceExpression) => issueType.elemID.getFullName()),
      }
    })
    .toArray()

  return changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === AUTOMATION_TYPE)
    .filter(isNotGlobalAutomation)
    .filter(isIssueCreateActionAutomation)
    .flatMap(instance => isInstanceWithInvalidIssueType(instance, projectsIssueTypeSchemes))
    .map(({ componentElemID, invalidIssueType }) => ({
      elemID: componentElemID,
      severity: 'Error' as SeverityLevel,
      message: 'Cannot deploy automation due to issue types not aligned with the automation project type issue scheme.',
      detailedMessage: `In order to deploy an automation you must use issue types from the automation project issue scheme. To fix it, change this issue type: ${invalidIssueType}`,
    }))
}
