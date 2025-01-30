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
import _ from 'lodash'
import { AUTOMATION_TYPE, PROJECT_TYPE } from '../../constants'
import { Component } from './automation_to_assets'

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

const isInstanceWithInvalidIssueType = (
  instance: InstanceElement,
  projectNameToIssueTypeNames: { key: string; value: string }[],
): IssueTypeError[] => {
  const invalidIssueTypes: IssueTypeError[] = []
  let projectKey: string | undefined

  walkOnValue({
    elemId: instance.elemID.createNestedID('components'),
    value: instance.value.components,
    func: ({ value, path }) => {
      if (_.isPlainObject(value) && value.fieldType === PROJECT_FIELD && isReferenceExpression(value.value?.value)) {
        projectKey = value.value.value.elemID.getFullName()
        return WALK_NEXT_STEP.RECURSE
      }

      if (
        isIssueTypeObject(value) &&
        value.fieldType === ISSUE_TYPE_FIELD &&
        isReferenceExpression(value.value.value)
      ) {
        const issueType = value.value.value.elemID
        const isValidIssueType = projectKey
          ? projectNameToIssueTypeNames.some(
              projectToIssueType =>
                projectToIssueType.key === projectKey && projectToIssueType.value.includes(issueType.getFullName()),
            )
          : false
        if (!isValidIssueType) {
          invalidIssueTypes.push({ componentElemID: path, invalidIssueType: issueType.name })
        }
      }

      return WALK_NEXT_STEP.RECURSE
    },
  })

  return invalidIssueTypes
}

const isNotGlobalAutomation = (instance: InstanceElement): boolean => instance.value.projects !== undefined

const isIssueCreateActionAutomation = (components: unknown): components is Component[] =>
  Array.isArray(components) && components.some(component => component.type === 'jira.issue.create')

const isProjectInstanceWithIssueTypeScheme = (instance: InstanceElement): instance is ProjectWithIssueTypeScheme =>
  isReferenceExpression(instance.value.issueTypeScheme)

export const automationIssueTypeValidator: ChangeValidator = async (changes, elementsSource) => {
  if (elementsSource === undefined) {
    return []
  }

  const projects = await getInstancesFromElementSource(elementsSource, [PROJECT_TYPE])
  const projectsIssueTypeSchemes = await Promise.all(
    projects.filter(isProjectInstanceWithIssueTypeScheme).map(async project => {
      const resolvedIssueTypeSchemeReferences =
        (await elementsSource.get(project.value.issueTypeScheme.elemID))?.value.issueTypeIds ?? []

      return {
        key: project.elemID.getFullName(),
        value: resolvedIssueTypeSchemeReferences
          .filter(isReferenceExpression)
          .map((issueType: ReferenceExpression) => issueType.elemID.getFullName()),
      }
    }),
  )

  return changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === AUTOMATION_TYPE)
    .filter(isNotGlobalAutomation)
    .filter(instance => isIssueCreateActionAutomation(instance.value.components))
    .flatMap(instance => isInstanceWithInvalidIssueType(instance, projectsIssueTypeSchemes))
    .filter(IssueTypeError => IssueTypeError.invalidIssueType !== undefined)
    .map(IssueTypeError => ({
      elemID: IssueTypeError.componentElemID,
      severity: 'Error' as SeverityLevel,
      message: 'Cannot deploy automation due to issue types not aligned with the relevant project type issue scheme.',
      detailedMessage: `In order to deploy an automation you must use issue types from the relevant project issue scheme. To fix it, change this issue type: ${IssueTypeError.invalidIssueType}`,
    }))
}
