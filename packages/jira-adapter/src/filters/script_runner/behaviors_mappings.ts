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
import { isResolvedReferenceExpression } from '@salto-io/adapter-utils'
import {
  ReferenceExpression,
  isAdditionOrModificationChange,
  getChangeData,
  isInstanceChange,
  isInstanceElement,
  Field,
  ListType,
  BuiltinTypes,
  Value,
  CORE_ANNOTATIONS,
  InstanceElement,
} from '@salto-io/adapter-api'
import { FilterCreator } from '../../filter'
import { BEHAVIOR_TYPE } from '../../constants'
import { findObject } from '../../utils'

const getIssueTypesForProject = (project: ReferenceExpression): string[] => {
  const issueTypeSchemeRef = project.value.value.issueTypeScheme
  if (!isResolvedReferenceExpression(issueTypeSchemeRef)) {
    return []
  }
  return (issueTypeSchemeRef.value.value.issueTypeIds ?? [])
    .filter(isResolvedReferenceExpression)
    .map((issueTypeRef: ReferenceExpression) => issueTypeRef.value.value.id)
}

const getIssueTypesForBehavior = (behavior: InstanceElement): string[] =>
  behavior.value.issueTypes
    .filter(isResolvedReferenceExpression)
    .map((issueTypeRef: ReferenceExpression) => issueTypeRef.value.value.id)

// This filter is used to convert from mappings to projects and issue types
const filter: FilterCreator = ({ config }) => {
  const preDeployProjects: Record<string, Value[]> = {}
  const preDeployIssueTypes: Record<string, Value[]> = {}
  return {
    name: 'behaviorsMappingsFilter',
    onFetch: async elements => {
      if (!config.fetch.enableScriptRunnerAddon) {
        return
      }
      elements
        .filter(isInstanceElement)
        .filter(instance => instance.elemID.typeName === BEHAVIOR_TYPE)
        .filter(instance => instance.value.mappings !== undefined)
        .forEach(instance => {
          instance.value.projects = Object.keys(instance.value.mappings)
          instance.value.issueTypes = Array.from(new Set(Object.values(instance.value.mappings).flat()))
          delete instance.value.mappings
        })
      const behaviorType = findObject(elements, BEHAVIOR_TYPE)
      if (behaviorType !== undefined) {
        const deployAnnotations = {
          [CORE_ANNOTATIONS.CREATABLE]: true,
          [CORE_ANNOTATIONS.UPDATABLE]: true,
          [CORE_ANNOTATIONS.DELETABLE]: true,
        }
        behaviorType.fields.projects = new Field(
          behaviorType,
          'projects',
          new ListType(BuiltinTypes.STRING),
          deployAnnotations,
        )
        behaviorType.fields.issueTypes = new Field(
          behaviorType,
          'issueTypes',
          new ListType(BuiltinTypes.STRING),
          deployAnnotations,
        )
        delete behaviorType.fields.mappings
      }
    },
    preDeploy: async changes => {
      if (!config.fetch.enableScriptRunnerAddon) {
        return
      }
      changes
        .filter(isAdditionOrModificationChange)
        .filter(isInstanceChange)
        .map(getChangeData)
        .filter(instance => instance.elemID.typeName === BEHAVIOR_TYPE)
        .forEach(instance => {
          preDeployProjects[instance.elemID.getFullName()] = instance.value.projects
          preDeployIssueTypes[instance.elemID.getFullName()] = instance.value.issueTypes
          instance.value.mappings = Object.fromEntries(
            instance.value.projects
              .filter(isResolvedReferenceExpression)
              .map((project: ReferenceExpression) => [
                project.value.value.id,
                getIssueTypesForProject(project).filter(issueType =>
                  getIssueTypesForBehavior(instance).includes(issueType),
                ),
              ]),
          )
          delete instance.value.projects
          delete instance.value.issueTypes
        })
    },
    onDeploy: async changes => {
      if (!config.fetch.enableScriptRunnerAddon) {
        return
      }

      changes
        .filter(isAdditionOrModificationChange)
        .filter(isInstanceChange)
        .map(getChangeData)
        .filter(instance => instance.elemID.typeName === BEHAVIOR_TYPE)
        .forEach(instance => {
          instance.value.projects = preDeployProjects[instance.elemID.getFullName()]
          instance.value.issueTypes = preDeployIssueTypes[instance.elemID.getFullName()]
          delete instance.value.mappings
        })
    },
  }
}
export default filter
