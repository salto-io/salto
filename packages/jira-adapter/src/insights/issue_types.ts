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
import { collections } from '@salto-io/lowerdash'
import {
  GetInsightsFunc,
  InstanceElement,
  isInstanceElement,
  isReferenceToInstance,
  isStaticFile,
} from '@salto-io/adapter-api'
import { ISSUE_TYPE_NAME, ISSUE_TYPE_SCHEMA_NAME } from '../constants'
import { isProjectInstance } from './projects'

const { makeArray } = collections.array

const ISSUE_TYPE = 'issueType'

const isIssueTypeInstance = (instance: InstanceElement): boolean => instance.elemID.typeName === ISSUE_TYPE_NAME

const isIssueTypeSchemeInstance = (instance: InstanceElement): boolean =>
  instance.elemID.typeName === ISSUE_TYPE_SCHEMA_NAME

const isIssueTypeWithoutAvatar = (instance: InstanceElement): boolean => !isStaticFile(instance.value.avatar)

const getUsedIssueTypesFromScheme = (instance: InstanceElement): InstanceElement[] =>
  makeArray(instance.value.issueTypeIds)
    .filter(isReferenceToInstance)
    .map(ref => ref.value)

const getUsedIssueTypeSchemeFromProject = (instance: InstanceElement): InstanceElement | undefined =>
  isReferenceToInstance(instance.value.issueTypeScheme) ? instance.value.issueTypeScheme.value : undefined

const getUnusedIssueTypes = (issueTypes: InstanceElement[], issueTypeSchemes: InstanceElement[]): InstanceElement[] => {
  const usedIssueTypes = new Set(
    issueTypeSchemes.flatMap(getUsedIssueTypesFromScheme).map(instance => instance.elemID.getFullName()),
  )
  return issueTypes.filter(instance => !usedIssueTypes.has(instance.elemID.getFullName()))
}

const getDuplicateNamesIssueTypes = (issueTypes: InstanceElement[]): InstanceElement[] =>
  Object.values(_.groupBy(issueTypes, instance => instance.value.name)).flatMap(instances =>
    instances.length > 1 ? instances : [],
  )

const getInactiveIssueTypeSchemes = (
  issueTypeSchemes: InstanceElement[],
  projects: InstanceElement[],
): InstanceElement[] => {
  const activeIssueTypeSchemes = new Set(
    projects
      .flatMap(instance => getUsedIssueTypeSchemeFromProject(instance) ?? [])
      .map(instance => instance.elemID.getFullName()),
  )
  return issueTypeSchemes.filter(instance => !activeIssueTypeSchemes.has(instance.elemID.getFullName()))
}

const getInsights: GetInsightsFunc = elements => {
  const instances = elements.filter(isInstanceElement)
  const issueTypes = instances.filter(isIssueTypeInstance)
  const issueTypeSchemes = instances.filter(isIssueTypeSchemeInstance)
  const projects = instances.filter(isProjectInstance)

  const issueTypesWithoutAvatar = issueTypes.filter(isIssueTypeWithoutAvatar).map(instance => ({
    path: instance.elemID,
    ruleId: `${ISSUE_TYPE}.noAvater`,
    message: 'Issue Type without avatar',
  }))

  const unusedIssueTypes = getUnusedIssueTypes(issueTypes, issueTypeSchemes).map(instance => ({
    path: instance.elemID,
    ruleId: `${ISSUE_TYPE}.unused`,
    message: 'Issue Type not used by any issue type scheme',
  }))

  const duplicateNamesIssueTypes = getDuplicateNamesIssueTypes(issueTypes).map(instance => ({
    path: instance.elemID,
    ruleId: `${ISSUE_TYPE}.duplicateName`,
    message: 'Issue Type with duplicate name',
  }))

  const unusedIssueTypeSchemes = getInactiveIssueTypeSchemes(issueTypeSchemes, projects).map(instance => ({
    path: instance.elemID,
    ruleId: `${ISSUE_TYPE}.inactiveScheme`,
    message: 'Issue Type Scheme is inactive',
  }))

  return issueTypesWithoutAvatar
    .concat(unusedIssueTypes)
    .concat(duplicateNamesIssueTypes)
    .concat(unusedIssueTypeSchemes)
}

export default getInsights
