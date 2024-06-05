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

import { collections } from '@salto-io/lowerdash'
import { GetInsightsFunc, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { isProjectInstance } from './projects'
import { ISSUE_TYPE_SCREEN_SCHEME_TYPE, SCREEN_SCHEME_TYPE, SCREEN_TYPE_NAME } from '../constants'
import { isReferenceToInstance } from './workflow_v1_transitions'
import { isWorkflowV1Instance, WorkflowV1Instance } from '../filters/workflow/types'
import { isWorkflowV2Instance, WorkflowV2Instance } from '../filters/workflowV2/types'

const { makeArray } = collections.array

const isScreenInstance = (instance: InstanceElement): boolean => instance.elemID.typeName === SCREEN_TYPE_NAME

const isScreenSchemeInstance = (instance: InstanceElement): boolean => instance.elemID.typeName === SCREEN_SCHEME_TYPE

const isIssueTypeScreenSchemeInstance = (instance: InstanceElement): boolean =>
  instance.elemID.typeName === ISSUE_TYPE_SCREEN_SCHEME_TYPE

const getUsedScreensFromScreenScheme = (instance: InstanceElement): InstanceElement[] =>
  Object.values(instance.value.screens ?? {})
    .filter(isReferenceToInstance)
    .map(ref => ref.value)

const getUsedScreenSchemesFromIssueTypeScreenScheme = (instance: InstanceElement): InstanceElement[] =>
  makeArray(instance.value.issueTypeMappings)
    .map(item => item.screenSchemeId)
    .filter(isReferenceToInstance)
    .map(ref => ref.value)

const getUsedScreensFromProject = (instance: InstanceElement): InstanceElement[] => {
  if (!isReferenceToInstance(instance.value.issueTypeScreenScheme)) {
    return []
  }
  const screenSchemes = getUsedScreenSchemesFromIssueTypeScreenScheme(instance.value.issueTypeScreenScheme.value)
  const screens = screenSchemes.flatMap(getUsedScreensFromScreenScheme)

  return screenSchemes.concat(screens)
}

const getUsedScreensFromWorkflowV1 = (instance: WorkflowV1Instance): InstanceElement[] =>
  Object.values(instance.value.transitions)
    .map(transition => transition.screen?.id)
    .filter(isReferenceToInstance)
    .map(ref => ref.value)

const getUsedScreensFromWorkflowV2 = (instance: WorkflowV2Instance): InstanceElement[] =>
  Object.values(instance.value.transitions)
    .map(transition => transition.transitionScreen?.parameters?.screenId)
    .filter(isReferenceToInstance)
    .map(ref => ref.value)

const getUnusedScreens = (
  projects: InstanceElement[],
  screens: InstanceElement[],
  screenSchemes: InstanceElement[],
): InstanceElement[] => {
  const usedScreensAndSchemes = new Set(
    projects.flatMap(getUsedScreensFromProject).map(instance => instance.elemID.getFullName()),
  )
  return screens.concat(screenSchemes).filter(instance => !usedScreensAndSchemes.has(instance.elemID.getFullName()))
}

const getInactiveScreens = (
  workflowsV1: WorkflowV1Instance[],
  workflowsV2: WorkflowV2Instance[],
  screens: InstanceElement[],
  screenSchemes: InstanceElement[],
  issueTypeScreenSchemes: InstanceElement[],
): InstanceElement[] => {
  const screensInWorkflowsV1 = workflowsV1.flatMap(getUsedScreensFromWorkflowV1)
  const screensInWorkflowsV2 = workflowsV2.flatMap(getUsedScreensFromWorkflowV2)
  const screensInSchemes = screenSchemes.flatMap(getUsedScreensFromScreenScheme)
  const screenSchemesInIssueTypeScreenSchemes = issueTypeScreenSchemes.flatMap(
    getUsedScreenSchemesFromIssueTypeScreenScheme,
  )

  const activeScreensAndSchemes = new Set(
    screensInWorkflowsV1
      .concat(screensInWorkflowsV2)
      .concat(screensInSchemes)
      .concat(screenSchemesInIssueTypeScreenSchemes)
      .map(instance => instance.elemID.getFullName()),
  )

  return screens.concat(screenSchemes).filter(instance => !activeScreensAndSchemes.has(instance.elemID.getFullName()))
}

const getInsights: GetInsightsFunc = elements => {
  const instances = elements.filter(isInstanceElement)
  const projects = instances.filter(isProjectInstance)
  const screens = instances.filter(isScreenInstance)
  const screenSchemes = instances.filter(isScreenSchemeInstance)
  const workflowsV1 = instances.filter(isWorkflowV1Instance)
  const workflowsV2 = instances.filter(isWorkflowV2Instance)
  const issueTypeScreenSchemes = instances.filter(isIssueTypeScreenSchemeInstance)

  const unusedScreens = getUnusedScreens(projects, screens, screenSchemes).map(instance => ({
    path: instance.elemID,
    ruleId: `${instance.elemID.typeName}.unused`,
    message: `${instance.elemID.typeName} is not used by any project`,
  }))

  const inactiveScreens = getInactiveScreens(
    workflowsV1,
    workflowsV2,
    screens,
    screenSchemes,
    issueTypeScreenSchemes,
  ).map(instance => ({
    path: instance.elemID,
    ruleId: `${instance.elemID.typeName}.inactive`,
    message: `${instance.elemID.typeName} is inactive`,
  }))

  return unusedScreens.concat(inactiveScreens)
}

export default getInsights
