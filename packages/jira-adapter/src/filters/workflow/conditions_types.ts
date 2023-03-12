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
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, ListType, ObjectType } from '@salto-io/adapter-api'
import { elements } from '@salto-io/adapter-components'
import { CONDITION_CONFIGURATION, JIRA } from '../../constants'

export const createConditionConfigurationTypes = (): {
  type: ObjectType
  subTypes: ObjectType[]
} => {
  const conditionProjectRoleType = new ObjectType({
    elemID: new ElemID(JIRA, 'ConditionProjectRole'),
    fields: {
      id: { refType: BuiltinTypes.STRING, annotations: { [CORE_ANNOTATIONS.CREATABLE]: true } },
    },
    path: [JIRA, elements.TYPES_PATH, 'ConditionProjectRole'],
  })

  const conditionStatusType = new ObjectType({
    elemID: new ElemID(JIRA, 'ConditionStatus'),
    fields: {
      id: { refType: BuiltinTypes.STRING, annotations: { [CORE_ANNOTATIONS.CREATABLE]: true } },
    },
    path: [JIRA, elements.TYPES_PATH, 'ConditionStatus'],
  })

  const conditionConfigurationType = new ObjectType({
    elemID: new ElemID(JIRA, CONDITION_CONFIGURATION),
    fields: {
      fieldId: {
        refType: BuiltinTypes.STRING,
        annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
      },
      comparator: {
        refType: BuiltinTypes.STRING,
        annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
      },
      fieldValue: {
        refType: BuiltinTypes.STRING,
        annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
      },
      permissionKey: {
        refType: BuiltinTypes.STRING,
        annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
      },
      ignoreLoopTransitions: {
        refType: BuiltinTypes.BOOLEAN,
        annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
      },
      includeCurrentStatus: {
        refType: BuiltinTypes.BOOLEAN,
        annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
      },
      mostRecentStatusOnly: {
        refType: BuiltinTypes.BOOLEAN,
        annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
      },
      reverseCondition: {
        refType: BuiltinTypes.BOOLEAN,
        annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
      },
      previousStatus: {
        refType: conditionStatusType,
        annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
      },
      value: {
        refType: BuiltinTypes.UNKNOWN,
        annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
      },
      toStatus: {
        refType: conditionStatusType,
        annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
      },
      fromStatus: {
        refType: conditionStatusType,
        annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
      },
      statuses: {
        refType: new ListType(conditionStatusType),
        annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
      },
      group: {
        refType: BuiltinTypes.STRING,
        annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
      },
      groups: {
        refType: new ListType(BuiltinTypes.STRING),
        annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
      },
      projectRoles: {
        refType: new ListType(conditionProjectRoleType),
        annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
      },
      allowUserInField: {
        refType: BuiltinTypes.BOOLEAN,
        annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
      },
      projectRole: {
        refType: conditionProjectRoleType,
        annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
      },
      comparisonType: {
        refType: BuiltinTypes.STRING,
        annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
      },
      FIELD_STATUS_ID: {
        refType: BuiltinTypes.STRING,
        annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
      },
      RESOLUTION_FIELD_NAME: {
        refType: BuiltinTypes.STRING,
        annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
      },
      FIELD_TEXT_FIELD: {
        refType: BuiltinTypes.STRING,
        annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
      },
      FIELD_LINKED_ISSUE_RESOLUTION: {
        refType: new ListType(BuiltinTypes.STRING),
        annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
      },
      FIELD_PROJECT_ROLE_IDS: {
        refType: new ListType(BuiltinTypes.STRING),
        annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
      },
      FIELD_GROUP_NAMES: {
        refType: new ListType(BuiltinTypes.STRING),
        annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
      },
      FIELD_REQUIRED_FIELDS: {
        refType: new ListType(BuiltinTypes.STRING),
        annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
      },
      FIELD_USER_IN_FIELDS: {
        refType: new ListType(BuiltinTypes.STRING),
        annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
      },
      FIELD_LINKED_ISSUE_STATUS: {
        refType: new ListType(BuiltinTypes.STRING),
        annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
      },
    },
    path: [JIRA, elements.TYPES_PATH, 'ConditionConfiguration'],
  })

  return {
    type: conditionConfigurationType,
    subTypes: [conditionProjectRoleType, conditionStatusType],
  }
}
