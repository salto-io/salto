/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { AUTOMATION_PROJECT_TYPE, AUTOMATION_TYPE, AUTOMATION_COMPONENT_TYPE,
  AUTOMATION_COMPONENT_VALUE_TYPE, JIRA } from '../../constants'

export const createAutomationTypes = (): {
  automationType: ObjectType
  subTypes: ObjectType[]
} => {
  const actorType = new ObjectType({
    elemID: new ElemID(JIRA, 'AutomationActor'),
    fields: {
      type: { refType: BuiltinTypes.STRING },
      value: { refType: BuiltinTypes.STRING },
    },
    path: [JIRA, elements.TYPES_PATH, elements.SUBTYPES_PATH, 'AutomationActor'],
  })

  const fieldType = new ObjectType({
    elemID: new ElemID(JIRA, 'AutomationField'),
    fields: {
      type: { refType: BuiltinTypes.STRING },
      value: { refType: BuiltinTypes.STRING },
    },
    path: [JIRA, elements.TYPES_PATH, elements.SUBTYPES_PATH, 'AutomationField'],
  })

  const recipientType = new ObjectType({
    elemID: new ElemID(JIRA, 'AutomationEmailRecipent'),
    fields: {
      value: { refType: BuiltinTypes.STRING },
    },
    path: [JIRA, elements.TYPES_PATH, elements.SUBTYPES_PATH, 'AutomationEmailRecipent'],
  })

  const statusType = new ObjectType({
    elemID: new ElemID(JIRA, 'AutomationStatus'),
    fields: {
      type: { refType: BuiltinTypes.STRING },
      value: { refType: BuiltinTypes.STRING },
    },
    path: [JIRA, elements.TYPES_PATH, elements.SUBTYPES_PATH, 'AutomationStatus'],
  })

  const operationType = new ObjectType({
    elemID: new ElemID(JIRA, 'AutomationOperation'),
    fields: {
      field: { refType: fieldType },
    },
    path: [JIRA, elements.TYPES_PATH, elements.SUBTYPES_PATH, 'AutomationOperation'],
  })

  const conditionCriteriaType = new ObjectType({
    elemID: new ElemID(JIRA, 'AutomationConditionCriteria'),
    fields: {
      value: { refType: BuiltinTypes.STRING },
    },
    path: [JIRA, elements.TYPES_PATH, elements.SUBTYPES_PATH, 'AutomationConditionCriteria'],
  })

  const conditionType = new ObjectType({
    elemID: new ElemID(JIRA, 'AutomationCondition'),
    fields: {
      field: { refType: BuiltinTypes.STRING },
      criteria: { refType: new ListType(conditionCriteriaType) },
    },
    path: [JIRA, elements.TYPES_PATH, elements.SUBTYPES_PATH, 'AutomationCondition'],
  })

  const groupType = new ObjectType({
    elemID: new ElemID(JIRA, 'AutomationGroup'),
    fields: {
      value: { refType: BuiltinTypes.STRING },
    },
    path: [JIRA, elements.TYPES_PATH, elements.SUBTYPES_PATH, 'AutomationGroup'],
  })

  const roleType = new ObjectType({
    elemID: new ElemID(JIRA, 'AutomationRole'),
    fields: {
      value: { refType: BuiltinTypes.STRING },
    },
    path: [JIRA, elements.TYPES_PATH, elements.SUBTYPES_PATH, 'AutomationRole'],
  })

  const subtaskType = new ObjectType({
    elemID: new ElemID(JIRA, 'AutomationSubtask'),
    fields: {
      type: { refType: BuiltinTypes.STRING },
    },
    path: [JIRA, elements.TYPES_PATH, elements.SUBTYPES_PATH, 'AutomationSubtask'],
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

  const componentValueType = new ObjectType({
    elemID: new ElemID(JIRA, AUTOMATION_COMPONENT_VALUE_TYPE),
    fields: {
      boardId: { refType: BuiltinTypes.NUMBER },
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
    },
    path: [JIRA, elements.TYPES_PATH, elements.SUBTYPES_PATH, AUTOMATION_COMPONENT_TYPE],
  })

  componentType.fields.children = new Field(
    componentType,
    'children',
    new ListType(componentType),
  )

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
      tags: { refType: new ListType(tagType) },
      canOtherRuleTrigger: { refType: BuiltinTypes.BOOLEAN },
      notifyOnError: { refType: BuiltinTypes.STRING },
      writeAccessType: { refType: BuiltinTypes.STRING },
    },
    path: [JIRA, elements.TYPES_PATH, AUTOMATION_TYPE],
  })

  return {
    automationType,
    subTypes: [actorType, componentType, tagType, projectType, componentValueType, fieldType,
      recipientType, statusType, operationType, conditionCriteriaType, conditionType,
      groupType, roleType, subtaskType],
  }
}
