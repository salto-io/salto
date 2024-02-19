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

import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, Field, ListType, ObjectType } from '@salto-io/adapter-api'
import { elements } from '@salto-io/adapter-components'
import {
  AUTOMATION_PROJECT_TYPE,
  AUTOMATION_TYPE,
  AUTOMATION_COMPONENT_TYPE,
  AUTOMATION_FIELD,
  AUTOMATION_STATUS,
  AUTOMATION_CONDITION,
  AUTOMATION_CONDITION_CRITERIA,
  AUTOMATION_SUBTASK,
  AUTOMATION_ROLE,
  AUTOMATION_GROUP,
  AUTOMATION_EMAIL_RECIPENT,
  AUTOMATION_COMPARE_VALUE,
  AUTOMATION_OPERATION,
  AUTOMATION_COMPONENT_VALUE_TYPE,
  JIRA,
  DELETE_LINK_TYPES,
} from '../../constants'

export const createAutomationTypes = (): {
  automationType: ObjectType
  subTypes: ObjectType[]
} => {
  const actorType = new ObjectType({
    elemID: new ElemID(JIRA, 'AutomationActor'),
    fields: {
      type: { refType: BuiltinTypes.STRING },
      value: { refType: BuiltinTypes.UNKNOWN },
    },
    path: [JIRA, elements.TYPES_PATH, elements.SUBTYPES_PATH, 'AutomationActor'],
  })

  const fieldType = new ObjectType({
    elemID: new ElemID(JIRA, AUTOMATION_FIELD),
    fields: {
      type: { refType: BuiltinTypes.STRING },
      value: { refType: BuiltinTypes.UNKNOWN },
    },
    path: [JIRA, elements.TYPES_PATH, elements.SUBTYPES_PATH, AUTOMATION_FIELD],
  })

  const recipientType = new ObjectType({
    elemID: new ElemID(JIRA, AUTOMATION_EMAIL_RECIPENT),
    fields: {
      value: { refType: BuiltinTypes.STRING },
    },
    path: [JIRA, elements.TYPES_PATH, elements.SUBTYPES_PATH, AUTOMATION_EMAIL_RECIPENT],
  })

  const statusType = new ObjectType({
    elemID: new ElemID(JIRA, AUTOMATION_STATUS),
    fields: {
      type: { refType: BuiltinTypes.STRING },
      value: { refType: BuiltinTypes.STRING },
    },
    path: [JIRA, elements.TYPES_PATH, elements.SUBTYPES_PATH, AUTOMATION_STATUS],
  })

  const operationType = new ObjectType({
    elemID: new ElemID(JIRA, AUTOMATION_OPERATION),
    fields: {
      field: { refType: fieldType },
      value: { refType: fieldType },
    },
    path: [JIRA, elements.TYPES_PATH, elements.SUBTYPES_PATH, AUTOMATION_OPERATION],
  })

  const conditionCriteriaType = new ObjectType({
    elemID: new ElemID(JIRA, AUTOMATION_CONDITION_CRITERIA),
    fields: {
      value: { refType: BuiltinTypes.UNKNOWN },
    },
    path: [JIRA, elements.TYPES_PATH, elements.SUBTYPES_PATH, AUTOMATION_CONDITION_CRITERIA],
  })

  const conditionType = new ObjectType({
    elemID: new ElemID(JIRA, AUTOMATION_CONDITION),
    fields: {
      field: { refType: BuiltinTypes.STRING },
      criteria: { refType: new ListType(conditionCriteriaType) },
    },
    path: [JIRA, elements.TYPES_PATH, elements.SUBTYPES_PATH, AUTOMATION_CONDITION],
  })

  const groupType = new ObjectType({
    elemID: new ElemID(JIRA, AUTOMATION_GROUP),
    fields: {
      value: { refType: BuiltinTypes.STRING },
    },
    path: [JIRA, elements.TYPES_PATH, elements.SUBTYPES_PATH, AUTOMATION_GROUP],
  })

  const roleType = new ObjectType({
    elemID: new ElemID(JIRA, AUTOMATION_ROLE),
    fields: {
      value: { refType: BuiltinTypes.STRING },
    },
    path: [JIRA, elements.TYPES_PATH, elements.SUBTYPES_PATH, AUTOMATION_ROLE],
  })

  const subtaskType = new ObjectType({
    elemID: new ElemID(JIRA, AUTOMATION_SUBTASK),
    fields: {
      type: { refType: BuiltinTypes.STRING },
    },
    path: [JIRA, elements.TYPES_PATH, elements.SUBTYPES_PATH, AUTOMATION_SUBTASK],
  })

  const projectType = new ObjectType({
    elemID: new ElemID(JIRA, AUTOMATION_PROJECT_TYPE),
    fields: {
      projectId: { refType: BuiltinTypes.STRING },
      projectTypeKey: { refType: BuiltinTypes.STRING },
      value: { refType: BuiltinTypes.STRING },
    },
    path: [JIRA, elements.TYPES_PATH, elements.SUBTYPES_PATH, AUTOMATION_PROJECT_TYPE],
  })

  const compareFieldValueType = new ObjectType({
    elemID: new ElemID(JIRA, AUTOMATION_COMPARE_VALUE),
    fields: {
      value: { refType: BuiltinTypes.UNKNOWN },
      values: { refType: new ListType(BuiltinTypes.UNKNOWN) },
    },
    path: [JIRA, elements.TYPES_PATH, elements.SUBTYPES_PATH, AUTOMATION_COMPARE_VALUE],
  })

  const deleteLinkTypes = new ObjectType({
    elemID: new ElemID(JIRA, DELETE_LINK_TYPES),
    fields: {
      id: { refType: BuiltinTypes.STRING },
      direction: { refType: BuiltinTypes.STRING },
      name: { refType: BuiltinTypes.STRING },
    },
  })

  const componentValueType = new ObjectType({
    elemID: new ElemID(JIRA, AUTOMATION_COMPONENT_VALUE_TYPE),
    fields: {
      boardId: { refType: BuiltinTypes.NUMBER },
      deleteLinkTypes: { refType: new ListType(deleteLinkTypes) },
      linkTypes: { refType: new ListType(BuiltinTypes.STRING) },
      linkType: { refType: BuiltinTypes.STRING },
      sourceProject: { refType: BuiltinTypes.STRING },
      targetProject: { refType: BuiltinTypes.STRING },
      groups: { refType: new ListType(BuiltinTypes.STRING) },
      group: { refType: groupType },
      operations: { refType: new ListType(operationType) },
      fields: { refType: new ListType(fieldType) },
      selectedField: { refType: fieldType },
      fromStatus: { refType: new ListType(statusType) },
      toStatus: { refType: new ListType(statusType) },
      destinationStatus: { refType: statusType },
      to: { refType: new ListType(recipientType) },
      cc: { refType: new ListType(recipientType) },
      bcc: { refType: new ListType(recipientType) },
      conditions: { refType: new ListType(conditionType) },
      visibility: { refType: groupType },
      subtasks: { refType: new ListType(subtaskType) },
      project: { refType: projectType },
      role: { refType: roleType },
      compareFieldValue: { refType: compareFieldValueType },
      workspaceId: { refType: BuiltinTypes.STRING },
      schemaLabel: { refType: BuiltinTypes.STRING },
      schemaId: { refType: BuiltinTypes.STRING },
      objectTypeLabel: { refType: BuiltinTypes.STRING },
      objectTypeId: { refType: BuiltinTypes.STRING },
    },
    path: [JIRA, elements.TYPES_PATH, elements.SUBTYPES_PATH, AUTOMATION_COMPONENT_VALUE_TYPE],
  })

  const componentType = new ObjectType({
    elemID: new ElemID(JIRA, AUTOMATION_COMPONENT_TYPE),
    fields: {
      component: { refType: BuiltinTypes.STRING },
      schemeVersion: { refType: BuiltinTypes.NUMBER },
      type: { refType: BuiltinTypes.STRING },
      value: { refType: componentValueType },
      hasAttachmentsValue: { refType: BuiltinTypes.BOOLEAN },
    },
    path: [JIRA, elements.TYPES_PATH, elements.SUBTYPES_PATH, AUTOMATION_COMPONENT_TYPE],
  })

  componentType.fields.children = new Field(componentType, 'children', new ListType(componentType))

  componentType.fields.conditions = new Field(componentType, 'conditions', new ListType(componentType))

  const tagType = new ObjectType({
    elemID: new ElemID(JIRA, 'AutomationTag'),
    fields: {
      tagType: { refType: BuiltinTypes.STRING },
      tagValue: { refType: BuiltinTypes.STRING },
    },
    path: [JIRA, elements.TYPES_PATH, elements.SUBTYPES_PATH, 'AutomationTag'],
  })

  const automationType = new ObjectType({
    elemID: new ElemID(JIRA, AUTOMATION_TYPE),
    fields: {
      id: {
        refType: BuiltinTypes.SERVICE_ID_NUMBER,
        annotations: {
          [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
        },
      },
      name: { refType: BuiltinTypes.STRING },
      created: {
        refType: BuiltinTypes.NUMBER,
        annotations: {
          [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
        },
      },
      state: { refType: BuiltinTypes.STRING },
      authorAccountId: { refType: BuiltinTypes.STRING },
      actor: { refType: actorType },
      projects: { refType: new ListType(projectType) },
      trigger: { refType: componentType },
      components: { refType: new ListType(componentType) },
      labels: { refType: new ListType(BuiltinTypes.NUMBER) },
      tags: { refType: new ListType(tagType) },
      canOtherRuleTrigger: { refType: BuiltinTypes.BOOLEAN },
      notifyOnError: { refType: BuiltinTypes.STRING },
      writeAccessType: { refType: BuiltinTypes.STRING },
    },
    path: [JIRA, elements.TYPES_PATH, AUTOMATION_TYPE],
  })

  return {
    automationType,
    subTypes: [
      actorType,
      componentType,
      tagType,
      projectType,
      componentValueType,
      fieldType,
      recipientType,
      statusType,
      operationType,
      conditionCriteriaType,
      conditionType,
      groupType,
      roleType,
      subtaskType,
      compareFieldValueType,
      deleteLinkTypes,
    ],
  }
}
