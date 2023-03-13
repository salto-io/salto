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
import _ from 'lodash'
import { isInstanceElement, isReferenceExpression } from '@salto-io/adapter-api'
import { references as referenceUtils } from '@salto-io/adapter-components'
import { GetLookupNameFunc } from '@salto-io/adapter-utils'
import { AUTOMATION_PROJECT_TYPE, AUTOMATION_FIELD, AUTOMATION_COMPONENT_VALUE_TYPE,
  BOARD_ESTIMATION_TYPE, ISSUE_TYPE_NAME, ISSUE_TYPE_SCHEMA_NAME, AUTOMATION_STATUS,
  AUTOMATION_CONDITION, AUTOMATION_CONDITION_CRITERIA, AUTOMATION_SUBTASK,
  AUTOMATION_ROLE, AUTOMATION_GROUP, AUTOMATION_EMAIL_RECIPENT, PROJECT_TYPE,
  SECURITY_LEVEL_TYPE, SECURITY_SCHEME_TYPE, STATUS_TYPE_NAME, WORKFLOW_TYPE_NAME, AUTOMATION_COMPARE_VALUE, AUTOMATION_TYPE, AUTOMATION_LABEL_TYPE, GROUP_TYPE_NAME, PRIORITY_SCHEME_TYPE_NAME, SCRIPT_RUNNER_TYPE, POST_FUNCTION_CONFIGURATION, RESOLUTION_TYPE_NAME, ISSUE_EVENT_TYPE_NAME, CONDITION_CONFIGURATION, PROJECT_ROLE_TYPE, VALIDATOR_CONFIGURATION, BOARD_TYPE_NAME, ISSUE_LINK_TYPE_NAME, DIRECTED_LINK_TYPE, MAIL_LIST_TYPE_NAME } from './constants'
import { getFieldsLookUpName } from './filters/fields/field_type_references_filter'
import { getRefType } from './references/workflow_properties'
import { FIELD_TYPE_NAME } from './filters/fields/constants'

const { neighborContextGetter, basicLookUp } = referenceUtils

const neighborContextFunc = (args: {
  contextFieldName: string
  levelsUp?: number
  contextValueMapper?: referenceUtils.ContextValueMapperFunc
  getLookUpName?: GetLookupNameFunc
}): referenceUtils.ContextFunc => neighborContextGetter({
  getLookUpName: async ({ ref }) => ref.elemID.name,
  ...args,
})

const toTypeName: referenceUtils.ContextValueMapperFunc = val => {
  if (val === 'issuetype') {
    return ISSUE_TYPE_NAME
  }
  return _.capitalize(val)
}

export const resolutionAndPriorityToTypeName: referenceUtils.ContextValueMapperFunc = val => {
  if (val === 'priority' || val === 'resolution') {
    return _.capitalize(val)
  }
  return undefined
}

export type ReferenceContextStrategyName = 'parentSelectedFieldType' | 'parentFieldType' | 'workflowStatusPropertiesContext'
| 'parentFieldId'

export const contextStrategyLookup: Record<
  ReferenceContextStrategyName, referenceUtils.ContextFunc
> = {
  parentSelectedFieldType: neighborContextFunc({ contextFieldName: 'selectedFieldType', levelsUp: 1, contextValueMapper: toTypeName }),
  parentFieldType: neighborContextFunc({ contextFieldName: 'fieldType', levelsUp: 1, contextValueMapper: toTypeName }),
  workflowStatusPropertiesContext: neighborContextFunc({ contextFieldName: 'key', contextValueMapper: getRefType }),
  parentFieldId: neighborContextFunc({ contextFieldName: 'fieldId', contextValueMapper: resolutionAndPriorityToTypeName }),
}

const groupNameSerialize: GetLookupNameFunc = ({ ref }) =>
  (ref.elemID.typeName === GROUP_TYPE_NAME ? ref.value.value.originalName : ref.value.value.id)

const groupIdSerialize: GetLookupNameFunc = ({ ref }) =>
  (isInstanceElement(ref.value) ? ref.value.value.groupId : ref.value)


type JiraReferenceSerializationStrategyName = 'groupStrategyById' | 'groupStrategyByOriginalName' | 'groupId' | 'key'
const JiraReferenceSerializationStrategyLookup: Record<
  JiraReferenceSerializationStrategyName | referenceUtils.ReferenceSerializationStrategyName,
  referenceUtils.ReferenceSerializationStrategy
> = {
  ...referenceUtils.ReferenceSerializationStrategyLookup,
  groupStrategyById: {
    serialize: groupNameSerialize,
    lookup: basicLookUp,
    lookupIndexName: 'id',
  },
  groupId: {
    serialize: groupIdSerialize,
    lookup: basicLookUp,
    lookupIndexName: 'groupId',
  },
  groupStrategyByOriginalName: {
    serialize: groupNameSerialize,
    lookup: basicLookUp,
    lookupIndexName: 'originalName',
  },
  key: {
    serialize: ({ ref }) => ref.value.value.key,
    lookup: basicLookUp,
    lookupIndexName: 'key',
  },
}

type JiraFieldReferenceDefinition = referenceUtils.FieldReferenceDefinition<
ReferenceContextStrategyName
> & {
  JiraSerializationStrategy?: JiraReferenceSerializationStrategyName
}
export class JiraFieldReferenceResolver extends referenceUtils.FieldReferenceResolver<
ReferenceContextStrategyName
> {
  constructor(def: JiraFieldReferenceDefinition) {
    super({ src: def.src, sourceTransformation: def.sourceTransformation ?? 'asString' })
    this.serializationStrategy = JiraReferenceSerializationStrategyLookup[
      def.JiraSerializationStrategy ?? def.serializationStrategy ?? 'fullValue'
    ]
    this.target = def.target
      ? { ...def.target, lookup: this.serializationStrategy.lookup }
      : undefined
  }
}

export const referencesRules: JiraFieldReferenceDefinition[] = [
  {
    src: { field: 'issueTypeId', parentTypes: ['IssueTypeScreenSchemeItem', 'FieldConfigurationIssueTypeItem', SCRIPT_RUNNER_TYPE] },
    serializationStrategy: 'id',
    target: { type: ISSUE_TYPE_NAME },
  },
  {
    src: { field: 'fieldConfigurationId', parentTypes: ['FieldConfigurationIssueTypeItem'] },
    serializationStrategy: 'id',
    target: { type: 'FieldConfiguration' },
  },
  {
    src: { field: 'screenSchemeId', parentTypes: ['IssueTypeScreenSchemeItem'] },
    serializationStrategy: 'id',
    target: { type: 'ScreenScheme' },
  },
  {
    src: { field: 'defaultIssueTypeId', parentTypes: [ISSUE_TYPE_SCHEMA_NAME] },
    serializationStrategy: 'id',
    target: { type: ISSUE_TYPE_NAME },
  },
  {
    src: { field: 'issueTypeIds', parentTypes: [ISSUE_TYPE_SCHEMA_NAME, 'CustomFieldContext'] },
    serializationStrategy: 'id',
    target: { type: ISSUE_TYPE_NAME },
  },
  {
    src: { field: 'projectIds', parentTypes: ['CustomFieldContext'] },
    serializationStrategy: 'id',
    target: { type: 'Project' },
  },
  {
    src: { field: 'id', parentTypes: ['WorkflowStatus'] },
    serializationStrategy: 'id',
    target: { type: STATUS_TYPE_NAME },
  },
  {
    src: { field: 'id', parentTypes: ['TransitionScreenDetails'] },
    serializationStrategy: 'id',
    target: { type: 'Screen' },
  },
  {
    src: { field: 'to', parentTypes: ['Transition'] },
    serializationStrategy: 'id',
    target: { type: STATUS_TYPE_NAME },
  },
  {
    src: { field: 'from', parentTypes: ['Transition'] },
    serializationStrategy: 'id',
    target: { type: STATUS_TYPE_NAME },
  },
  {
    src: { field: 'id', parentTypes: ['ProjectRoleConfig'] },
    serializationStrategy: 'id',
    target: { type: 'ProjectRole' },
  },
  {
    src: { field: 'fieldId', parentTypes: [POST_FUNCTION_CONFIGURATION] },
    serializationStrategy: 'id',
    target: { type: 'Field' },
  },
  {
    src: { field: 'destinationFieldId', parentTypes: [POST_FUNCTION_CONFIGURATION] },
    serializationStrategy: 'id',
    target: { type: 'Field' },
  },
  {
    src: { field: 'sourceFieldId', parentTypes: [POST_FUNCTION_CONFIGURATION] },
    serializationStrategy: 'id',
    target: { type: 'Field' },
  },
  {
    src: { field: 'date1', parentTypes: [VALIDATOR_CONFIGURATION] },
    serializationStrategy: 'id',
    target: { type: 'Field' },
  },
  {
    src: { field: 'date2', parentTypes: [VALIDATOR_CONFIGURATION] },
    serializationStrategy: 'id',
    target: { type: 'Field' },
  },
  {
    src: { field: 'fieldIds', parentTypes: [VALIDATOR_CONFIGURATION] },
    serializationStrategy: 'id',
    target: { type: 'Field' },
  },
  {
    src: { field: 'fieldId', parentTypes: [VALIDATOR_CONFIGURATION] },
    serializationStrategy: 'id',
    target: { type: 'Field' },
  },
  {
    src: { field: 'id', parentTypes: ['StatusRef'] },
    serializationStrategy: 'id',
    target: { type: STATUS_TYPE_NAME },
  },
  {
    src: { field: 'parameter', parentTypes: ['PermissionHolder'] },
    serializationStrategy: 'id',
    target: { type: 'Field' },
  },
  {
    src: { field: 'parameter', parentTypes: ['PermissionHolder'] },
    serializationStrategy: 'id',
    target: { type: 'ProjectRole' },
  },
  {
    src: { field: 'id', parentTypes: ['ProjectPermission'] },
    serializationStrategy: 'id',
    target: { type: 'Project' },
  },
  {
    src: { field: 'id', parentTypes: ['ProjectRolePermission'] },
    serializationStrategy: 'id',
    target: { type: 'ProjectRole' },
  },
  {
    src: { field: 'filterId', parentTypes: ['Board'] },
    serializationStrategy: 'id',
    target: { type: 'Filter' },
  },
  {
    src: { field: 'workflowScheme', parentTypes: ['Project'] },
    serializationStrategy: 'id',
    target: { type: 'WorkflowScheme' },
  },
  {
    src: { field: 'issueTypeScreenScheme', parentTypes: ['Project'] },
    serializationStrategy: 'id',
    target: { type: 'IssueTypeScreenScheme' },
  },
  {
    src: { field: 'fieldConfigurationScheme', parentTypes: ['Project'] },
    serializationStrategy: 'id',
    target: { type: 'FieldConfigurationScheme' },
  },
  {
    src: { field: 'issueTypeScheme', parentTypes: ['Project'] },
    serializationStrategy: 'id',
    target: { type: ISSUE_TYPE_SCHEMA_NAME },
  },
  {
    src: { field: 'permissionScheme', parentTypes: ['Project'] },
    serializationStrategy: 'id',
    target: { type: 'PermissionScheme' },
  },
  {
    src: { field: 'notificationScheme', parentTypes: ['Project'] },
    serializationStrategy: 'id',
    target: { type: 'NotificationScheme' },
  },
  {
    src: { field: 'issueSecurityScheme', parentTypes: ['Project'] },
    serializationStrategy: 'id',
    target: { type: 'SecurityScheme' },
  },
  {
    src: { field: 'priorityScheme', parentTypes: ['Project'] },
    serializationStrategy: 'id',
    target: { type: PRIORITY_SCHEME_TYPE_NAME },
  },
  {
    src: { field: 'fields', parentTypes: ['ScreenableTab'] },
    serializationStrategy: 'id',
    target: { type: 'Field' },
  },
  {
    src: { field: 'id', parentTypes: ['FieldConfigurationItem'] },
    serializationStrategy: 'id',
    target: { type: 'Field' },
  },
  {
    src: { field: 'projectId', parentTypes: ['Board_location', SCRIPT_RUNNER_TYPE] },
    serializationStrategy: 'id',
    target: { type: 'Project' },
  },
  {
    src: { field: 'projectKeyOrId', parentTypes: ['Board_location'] },
    serializationStrategy: 'id',
    target: { type: 'Project' },
  },
  {
    src: { field: 'edit', parentTypes: ['ScreenTypes'] },
    serializationStrategy: 'id',
    target: { type: 'Screen' },
  },
  {
    src: { field: 'create', parentTypes: ['ScreenTypes'] },
    serializationStrategy: 'id',
    target: { type: 'Screen' },
  },
  {
    src: { field: 'view', parentTypes: ['ScreenTypes'] },
    serializationStrategy: 'id',
    target: { type: 'Screen' },
  },
  {
    src: { field: 'default', parentTypes: ['ScreenTypes'] },
    serializationStrategy: 'id',
    target: { type: 'Screen' },
  },
  {
    src: { field: 'defaultWorkflow', parentTypes: ['WorkflowScheme'] },
    serializationStrategy: 'name',
    target: { type: WORKFLOW_TYPE_NAME },
  },
  {
    src: { field: 'workflow', parentTypes: ['WorkflowSchemeItem'] },
    serializationStrategy: 'name',
    target: { type: WORKFLOW_TYPE_NAME },
  },
  {
    src: { field: 'issueType', parentTypes: ['WorkflowSchemeItem'] },
    serializationStrategy: 'id',
    target: { type: ISSUE_TYPE_NAME },
  },
  {
    src: { field: 'statusId', parentTypes: ['StatusMigration'] },
    serializationStrategy: 'id',
    target: { type: STATUS_TYPE_NAME },
  },
  {
    src: { field: 'newStatusId', parentTypes: ['StatusMigration'] },
    serializationStrategy: 'id',
    target: { type: STATUS_TYPE_NAME },
  },
  {
    src: { field: 'issueTypeId', parentTypes: ['StatusMigration'] },
    serializationStrategy: 'id',
    target: { type: ISSUE_TYPE_NAME },
  },
  {
    src: { field: 'field', parentTypes: [BOARD_ESTIMATION_TYPE, MAIL_LIST_TYPE_NAME] },
    serializationStrategy: 'id',
    target: { type: 'Field' },
  },
  {
    src: { field: 'timeTracking', parentTypes: [BOARD_ESTIMATION_TYPE] },
    serializationStrategy: 'id',
    target: { type: 'Field' },
  },
  {
    src: { field: 'rankCustomFieldId', parentTypes: ['BoardConfiguration_ranking'] },
    serializationStrategy: 'id',
    target: { type: 'Field' },
  },
  {
    src: { field: 'statusCategory', parentTypes: [STATUS_TYPE_NAME] },
    serializationStrategy: 'id',
    target: { type: 'StatusCategory' },
  },
  {
    src: { field: 'defaultLevel', parentTypes: [SECURITY_SCHEME_TYPE] },
    serializationStrategy: 'id',
    target: { type: SECURITY_LEVEL_TYPE },
  },
  {
    src: { field: 'projectId', parentTypes: [AUTOMATION_PROJECT_TYPE] },
    serializationStrategy: 'id',
    target: { type: PROJECT_TYPE },
  },
  {
    src: { field: 'statuses', parentTypes: ['BoardConfiguration_columnConfig_columns'] },
    serializationStrategy: 'id',
    target: { type: STATUS_TYPE_NAME },
  },
  {
    src: { field: 'id', parentTypes: ['PostFunctionEvent'] },
    serializationStrategy: 'id',
    target: { type: 'IssueEvent' },
  },
  {
    src: { field: 'eventType', parentTypes: ['NotificationSchemeEvent'] },
    serializationStrategy: 'id',
    target: { type: 'IssueEvent' },
  },
  {
    src: { field: 'fieldId', parentTypes: ['ConditionConfiguration'] },
    serializationStrategy: 'id',
    target: { type: 'Field' },
  },
  {
    src: { field: 'groups', parentTypes: ['ConditionConfiguration'] },
    JiraSerializationStrategy: 'groupStrategyByOriginalName',
    target: { type: GROUP_TYPE_NAME },
  },
  {
    src: { field: 'group', parentTypes: ['ConditionConfiguration', MAIL_LIST_TYPE_NAME] },
    JiraSerializationStrategy: 'groupStrategyByOriginalName',
    target: { type: GROUP_TYPE_NAME },
  },
  {
    src: { field: 'id', parentTypes: ['ConditionStatus'] },
    serializationStrategy: 'id',
    target: { type: 'Status' },
  },
  {
    src: { field: 'id', parentTypes: ['ConditionProjectRole'] },
    serializationStrategy: 'id',
    target: { type: 'ProjectRole' },
  },
  {
    src: { field: 'groups', parentTypes: ['ApplicationRole'] },
    JiraSerializationStrategy: 'groupStrategyByOriginalName',
    target: { type: GROUP_TYPE_NAME },
  },
  {
    src: { field: 'defaultGroups', parentTypes: ['ApplicationRole'] },
    JiraSerializationStrategy: 'groupStrategyByOriginalName',
    target: { type: GROUP_TYPE_NAME },
  },
  {
    src: { field: 'parameter', parentTypes: ['PermissionHolder'] },
    JiraSerializationStrategy: 'groupStrategyByOriginalName',
    target: { type: GROUP_TYPE_NAME },
  },
  {
    src: { field: 'name', parentTypes: ['GroupName'] },
    JiraSerializationStrategy: 'groupStrategyByOriginalName',
    target: { type: GROUP_TYPE_NAME },
  },
  {
    src: { field: 'groupName', parentTypes: [SCRIPT_RUNNER_TYPE] },
    JiraSerializationStrategy: 'groupStrategyByOriginalName',
    target: { type: GROUP_TYPE_NAME },
  },
  {
    src: { field: 'boardId', parentTypes: [AUTOMATION_COMPONENT_VALUE_TYPE, SCRIPT_RUNNER_TYPE] },
    serializationStrategy: 'id',
    target: { type: 'Board' },
  },
  {
    src: { field: 'linkTypes', parentTypes: [AUTOMATION_COMPONENT_VALUE_TYPE] },
    serializationStrategy: 'nameWithPath',
    target: { type: ISSUE_LINK_TYPE_NAME },
  },
  {
    src: { field: 'linkType', parentTypes: [AUTOMATION_COMPONENT_VALUE_TYPE] },
    serializationStrategy: 'id',
    target: { type: ISSUE_LINK_TYPE_NAME },
  },
  {
    src: { field: 'linkTypeId', parentTypes: [SCRIPT_RUNNER_TYPE] },
    serializationStrategy: 'id',
    target: { type: ISSUE_LINK_TYPE_NAME },
  },
  {
    src: { field: 'sourceProject', parentTypes: [AUTOMATION_COMPONENT_VALUE_TYPE] },
    serializationStrategy: 'id',
    target: { type: 'Project' },
  },
  {
    src: { field: 'targetProject', parentTypes: [AUTOMATION_COMPONENT_VALUE_TYPE] },
    serializationStrategy: 'id',
    target: { type: 'Project' },
  },
  {
    src: { field: 'groups', parentTypes: [AUTOMATION_COMPONENT_VALUE_TYPE] },
    JiraSerializationStrategy: 'groupStrategyByOriginalName',
    target: { type: GROUP_TYPE_NAME },
  },
  // Overlapping rules, serialization strategies guarantee no conflict
  {
    src: { field: 'value', parentTypes: [AUTOMATION_FIELD] },
    serializationStrategy: 'id',
    target: { type: 'Field' },
  },
  {
    src: { field: 'value', parentTypes: [AUTOMATION_FIELD] },
    serializationStrategy: 'nameWithPath',
    target: { type: 'Field' },
  },
  // Overlapping rules, serialization strategies guarantee no conflict
  {
    src: { field: 'value', parentTypes: [AUTOMATION_STATUS] },
    serializationStrategy: 'id',
    target: { type: 'Status' },
  },
  {
    src: { field: 'value', parentTypes: [AUTOMATION_STATUS] },
    serializationStrategy: 'nameWithPath',
    target: { type: 'Status' },
  },
  {
    src: { field: 'value', parentTypes: [AUTOMATION_EMAIL_RECIPENT, AUTOMATION_CONDITION_CRITERIA, AUTOMATION_GROUP] },
    JiraSerializationStrategy: 'groupStrategyByOriginalName',
    target: { type: GROUP_TYPE_NAME },
  },
  {
    src: { field: 'field', parentTypes: [AUTOMATION_CONDITION] },
    serializationStrategy: 'id',
    target: { type: 'Field' },
  },
  {
    src: { field: 'type', parentTypes: [AUTOMATION_SUBTASK] },
    serializationStrategy: 'id',
    target: { type: 'IssueType' },
  },
  {
    src: { field: 'value', parentTypes: [AUTOMATION_PROJECT_TYPE] },
    serializationStrategy: 'id',
    target: { type: 'Project' },
  },
  {
    src: { field: 'value', parentTypes: [AUTOMATION_ROLE] },
    serializationStrategy: 'nameWithPath',
    target: { type: 'ProjectRole' },
  },
  // Overlapping rules, serialization strategies guarantee no conflict
  {
    src: { field: 'value', parentTypes: [AUTOMATION_COMPARE_VALUE] },
    serializationStrategy: 'id',
    target: { typeContext: 'parentSelectedFieldType' },
  },
  {
    src: { field: 'value', parentTypes: [AUTOMATION_COMPARE_VALUE] },
    serializationStrategy: 'nameWithPath',
    target: { typeContext: 'parentSelectedFieldType' },
  },
  // Overlapping rules, serialization strategies guarantee no conflict
  {
    src: { field: 'values', parentTypes: [AUTOMATION_COMPARE_VALUE] },
    serializationStrategy: 'id',
    target: { typeContext: 'parentSelectedFieldType' },
  },
  {
    src: { field: 'values', parentTypes: [AUTOMATION_COMPARE_VALUE] },
    serializationStrategy: 'nameWithPath',
    target: { typeContext: 'parentSelectedFieldType' },
  },
  {
    src: { field: 'fieldValue', parentTypes: [POST_FUNCTION_CONFIGURATION] },
    serializationStrategy: 'id',
    target: { typeContext: 'parentFieldId' },
  },
  {
    src: { field: 'labels', parentTypes: [AUTOMATION_TYPE] },
    serializationStrategy: 'id',
    target: { type: AUTOMATION_LABEL_TYPE },
  },
  {
    src: { field: 'value', parentTypes: [AUTOMATION_FIELD] },
    serializationStrategy: 'id',
    target: { typeContext: 'parentFieldType' },
  },
  {
    src: { field: 'value', parentTypes: ['WorkflowProperty'] },
    JiraSerializationStrategy: 'groupStrategyById',
    target: { typeContext: 'workflowStatusPropertiesContext' },
  },
  {
    src: { field: 'value', parentTypes: ['WorkflowProperty'] },
    JiraSerializationStrategy: 'groupStrategyByOriginalName',
    target: { typeContext: 'workflowStatusPropertiesContext' },
  },
  {
    src: { field: 'optionIds', parentTypes: ['PriorityScheme'] },
    serializationStrategy: 'id',
    target: { type: 'Priority' },
  },
  {
    src: { field: 'defaultOptionId', parentTypes: ['PriorityScheme'] },
    serializationStrategy: 'id',
    target: { type: 'Priority' },
  },
  {
    src: { field: 'statType', parentTypes: ['GadgetConfig'] },
    serializationStrategy: 'id',
    target: { type: 'Field' },
  },
  {
    src: { field: 'groups', parentTypes: ['UserFilter'] },
    JiraSerializationStrategy: 'groupStrategyByOriginalName',
    target: { type: GROUP_TYPE_NAME },
  },
  {
    src: { field: 'roleIds', parentTypes: ['UserFilter'] },
    serializationStrategy: 'id',
    target: { type: PROJECT_ROLE_TYPE },
  },
  {
    src: { field: 'roleId', parentTypes: [SCRIPT_RUNNER_TYPE] },
    serializationStrategy: 'id',
    target: { type: PROJECT_ROLE_TYPE },
  },
  {
    src: { field: 'FIELD_ROLE_ID', parentTypes: [POST_FUNCTION_CONFIGURATION] },
    serializationStrategy: 'id',
    target: { type: PROJECT_ROLE_TYPE },
  },
  { // for cloud
    src: { field: 'groupIds', parentTypes: ['CustomFieldContextDefaultValue'] },
    JiraSerializationStrategy: 'groupId',
    target: { type: GROUP_TYPE_NAME },
  },
  { // for cloud
    src: { field: 'groupId', parentTypes: ['CustomFieldContextDefaultValue'] },
    JiraSerializationStrategy: 'groupId',
    target: { type: GROUP_TYPE_NAME },
  },
  { // for DC
    src: { field: 'groupIds', parentTypes: ['CustomFieldContextDefaultValue'] },
    serializationStrategy: 'nameWithPath',
    target: { type: GROUP_TYPE_NAME },
  },
  { // for DC
    src: { field: 'groupId', parentTypes: ['CustomFieldContextDefaultValue'] },
    serializationStrategy: 'nameWithPath',
    target: { type: GROUP_TYPE_NAME },
  },
  {
    src: { field: 'projectId', parentTypes: ['CustomFieldContextDefaultValue'] },
    serializationStrategy: 'id',
    target: { type: PROJECT_TYPE },
  },
  {
    src: { field: 'FIELD_RESOLUTION_ID', parentTypes: [POST_FUNCTION_CONFIGURATION] },
    serializationStrategy: 'id',
    target: { type: RESOLUTION_TYPE_NAME },
  },
  {
    src: { field: 'FIELD_EVENT_ID', parentTypes: [POST_FUNCTION_CONFIGURATION] },
    serializationStrategy: 'id',
    target: { type: ISSUE_EVENT_TYPE_NAME },
  },
  {
    src: { field: 'FIELD_TARGET_ISSUE_TYPE', parentTypes: [POST_FUNCTION_CONFIGURATION] },
    serializationStrategy: 'id',
    target: { type: ISSUE_TYPE_NAME },
  },
  {
    src: { field: 'FIELD_TARGET_FIELD_ID', parentTypes: [POST_FUNCTION_CONFIGURATION] },
    serializationStrategy: 'id',
    target: { type: FIELD_TYPE_NAME },
  },
  {
    src: { field: 'FIELD_SOURCE_FIELD_ID', parentTypes: [POST_FUNCTION_CONFIGURATION] },
    serializationStrategy: 'id',
    target: { type: FIELD_TYPE_NAME },
  },
  {
    src: { field: 'FIELD_TARGET_PROJECT', parentTypes: [POST_FUNCTION_CONFIGURATION] },
    JiraSerializationStrategy: 'key',
    target: { type: PROJECT_TYPE },
  },
  {
    src: { field: 'FIELD_SELECTED_FIELDS', parentTypes: [POST_FUNCTION_CONFIGURATION] },
    serializationStrategy: 'id',
    target: { type: FIELD_TYPE_NAME },
  },
  {
    src: { field: 'FIELD_SECURITY_LEVEL_ID', parentTypes: [POST_FUNCTION_CONFIGURATION] },
    serializationStrategy: 'id',
    target: { type: SECURITY_LEVEL_TYPE },
  },
  {
    src: { field: 'FIELD_BOARD_ID', parentTypes: [POST_FUNCTION_CONFIGURATION] },
    serializationStrategy: 'id',
    target: { type: BOARD_TYPE_NAME },
  },
  {
    src: { field: 'FIELD_STATUS_ID', parentTypes: [CONDITION_CONFIGURATION] },
    serializationStrategy: 'id',
    target: { type: STATUS_TYPE_NAME },
  },
  {
    src: { field: 'FIELD_LINKED_ISSUE_RESOLUTION', parentTypes: [CONDITION_CONFIGURATION] },
    serializationStrategy: 'id',
    target: { type: RESOLUTION_TYPE_NAME },
  },
  {
    src: { field: 'FIELD_PROJECT_ROLE_IDS', parentTypes: [CONDITION_CONFIGURATION] },
    serializationStrategy: 'id',
    target: { type: PROJECT_ROLE_TYPE },
  },
  {
    src: { field: 'FIELD_GROUP_NAMES', parentTypes: [CONDITION_CONFIGURATION] },
    JiraSerializationStrategy: 'groupStrategyByOriginalName',
    target: { type: GROUP_TYPE_NAME },
  },
  {
    src: { field: 'RESOLUTION_FIELD_NAME', parentTypes: [CONDITION_CONFIGURATION] },
    serializationStrategy: 'id',
    target: { type: RESOLUTION_TYPE_NAME },
  },
  {
    src: { field: 'FIELD_LINKED_ISSUE_STATUS', parentTypes: [CONDITION_CONFIGURATION] },
    serializationStrategy: 'id',
    target: { type: STATUS_TYPE_NAME },
  },
  {
    src: { field: 'FIELD_TEXT_FIELD', parentTypes: [CONDITION_CONFIGURATION, VALIDATOR_CONFIGURATION] },
    serializationStrategy: 'id',
    target: { type: FIELD_TYPE_NAME },
  },
  {
    src: { field: 'FIELD_USER_IN_FIELDS', parentTypes: [CONDITION_CONFIGURATION, VALIDATOR_CONFIGURATION] },
    serializationStrategy: 'id',
    target: { type: FIELD_TYPE_NAME },
  },
  {
    src: { field: 'FIELD_REQUIRED_FIELDS', parentTypes: [CONDITION_CONFIGURATION, VALIDATOR_CONFIGURATION] },
    serializationStrategy: 'id',
    target: { type: FIELD_TYPE_NAME },
  },
  {
    src: { field: 'FIELD_FIELD_IDS', parentTypes: [VALIDATOR_CONFIGURATION] },
    serializationStrategy: 'id',
    target: { type: FIELD_TYPE_NAME },
  },
  {
    src: { field: 'FIELD_FORM_FIELD', parentTypes: [VALIDATOR_CONFIGURATION] },
    serializationStrategy: 'id',
    target: { type: FIELD_TYPE_NAME },
  },
  {
    src: { field: 'linkType', parentTypes: [DIRECTED_LINK_TYPE] },
    serializationStrategy: 'id',
    target: { type: ISSUE_LINK_TYPE_NAME },
  },
  {
    src: { field: 'field', parentTypes: [MAIL_LIST_TYPE_NAME] },
    serializationStrategy: 'id',
    target: { type: FIELD_TYPE_NAME },
  },
  {
    src: { field: 'role', parentTypes: [MAIL_LIST_TYPE_NAME] },
    serializationStrategy: 'name',
    target: { type: PROJECT_ROLE_TYPE },
  },
]

const lookupNameFuncs: GetLookupNameFunc[] = [
  getFieldsLookUpName,
  // The second param is needed to resolve references by JiraSerializationStrategy
  referenceUtils.generateLookupFunc(referencesRules, defs => new JiraFieldReferenceResolver(defs)),
]

export const getLookUpName: GetLookupNameFunc = async args => (
  lookupNameFuncs
    .map(lookupFunc => lookupFunc(args))
    .find(res => !isReferenceExpression(res))
)
