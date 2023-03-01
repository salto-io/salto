/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, ObjectType } from '@salto-io/adapter-api'
import { elements } from '@salto-io/adapter-components'
import { createMatchingObjectType } from '@salto-io/adapter-utils'
import { JIRA, SCRIPT_RUNNER } from '../../constants'
import { PostFunction } from './types'

const postFunctionEventType = new ObjectType({
  elemID: new ElemID(JIRA, 'PostFunctionEvent'),
  fields: {
    id: { refType: BuiltinTypes.STRING, annotations: { [CORE_ANNOTATIONS.CREATABLE]: true } },
  },
  path: [JIRA, elements.TYPES_PATH, 'PostFunctionEvent'],
})

const projectRoleConfigType = new ObjectType({
  elemID: new ElemID(JIRA, 'ProjectRoleConfig'),
  fields: {
    id: { refType: BuiltinTypes.STRING, annotations: { [CORE_ANNOTATIONS.CREATABLE]: true } },
  },
  path: [JIRA, elements.TYPES_PATH, 'ProjectRoleConfig'],
})

const issueSecurityLevelType = new ObjectType({
  elemID: new ElemID(JIRA, 'IssueSecurityLevel'),
  fields: {
    id: { refType: BuiltinTypes.STRING, annotations: { [CORE_ANNOTATIONS.CREATABLE]: true } },
  },
  path: [JIRA, elements.TYPES_PATH, 'IssueSecurityLevel'],
})

const webhookConfigType = new ObjectType({
  elemID: new ElemID(JIRA, 'WebhookConfig'),
  fields: {
    id: { refType: BuiltinTypes.STRING, annotations: { [CORE_ANNOTATIONS.CREATABLE]: true } },
  },
  path: [JIRA, elements.TYPES_PATH, 'WebhookConfig'],
})

const ScriptRunnerObjectType = new ObjectType({
  elemID: new ElemID(JIRA, SCRIPT_RUNNER),
  fields: {
    issueTypeId: { refType: BuiltinTypes.STRING, annotations: { [CORE_ANNOTATIONS.CREATABLE]: true } },
    projectId: { refType: BuiltinTypes.STRING, annotations: { [CORE_ANNOTATIONS.CREATABLE]: true } },
    groupName: { refType: BuiltinTypes.STRING, annotations: { [CORE_ANNOTATIONS.CREATABLE]: true } },
    roleId: { refType: BuiltinTypes.STRING, annotations: { [CORE_ANNOTATIONS.CREATABLE]: true } },
    boardId: { refType: BuiltinTypes.STRING, annotations: { [CORE_ANNOTATIONS.CREATABLE]: true } },
    linkTypeId: { refType: BuiltinTypes.STRING, annotations: { [CORE_ANNOTATIONS.CREATABLE]: true } },
  },
  path: [JIRA, elements.SUBTYPES_PATH, SCRIPT_RUNNER],
})

const postFunctionConfigurationType = new ObjectType({
  elemID: new ElemID(JIRA, 'PostFunctionConfiguration'),
  fields: {
    event: { refType: postFunctionEventType, annotations: { [CORE_ANNOTATIONS.CREATABLE]: true } },
    fieldId: { refType: BuiltinTypes.STRING, annotations: { [CORE_ANNOTATIONS.CREATABLE]: true } },
    sourceFieldId: {
      refType: BuiltinTypes.STRING,
      annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
    },
    destinationFieldId: {
      refType: BuiltinTypes.STRING,
      annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
    },
    copyType: { refType: BuiltinTypes.STRING, annotations: { [CORE_ANNOTATIONS.CREATABLE]: true } },
    projectRole: {
      refType: projectRoleConfigType,
      annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
    },
    issueSecurityLevel: {
      refType: issueSecurityLevelType,
      annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
    },
    webhook: { refType: webhookConfigType, annotations: { [CORE_ANNOTATIONS.CREATABLE]: true } },
    mode: { refType: BuiltinTypes.STRING, annotations: { [CORE_ANNOTATIONS.CREATABLE]: true } },
    fieldValue: {
      refType: BuiltinTypes.STRING,
      annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
    },
    value: { refType: BuiltinTypes.STRING, annotations: { [CORE_ANNOTATIONS.CREATABLE]: true } },
    scriptRunner: { refType: ScriptRunnerObjectType, annotations: { [CORE_ANNOTATIONS.CREATABLE]: true } },
  },
  path: [JIRA, elements.TYPES_PATH, 'PostFunctionConfiguration'],
})

export const postFunctionType = createMatchingObjectType<PostFunction>({
  elemID: new ElemID(JIRA, 'PostFunction'),
  fields: {
    type: { refType: BuiltinTypes.STRING },
    configuration: { refType: postFunctionConfigurationType },
  },
  path: [JIRA, elements.TYPES_PATH, 'PostFunction'],
})

export const types = [
  postFunctionEventType,
  projectRoleConfigType,
  issueSecurityLevelType,
  webhookConfigType,
  ScriptRunnerObjectType,
  postFunctionConfigurationType,
  postFunctionType,
]
