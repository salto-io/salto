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
import { isInstanceElement, isReferenceExpression } from '@salto-io/adapter-api'
import { references as referenceUtils } from '@salto-io/adapter-components'
import { GetLookupNameFunc } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import {
  AUTOMATION_PROJECT_TYPE,
  AUTOMATION_FIELD,
  AUTOMATION_COMPONENT_VALUE_TYPE,
  BOARD_ESTIMATION_TYPE,
  ISSUE_TYPE_NAME,
  ISSUE_TYPE_SCHEMA_NAME,
  AUTOMATION_STATUS,
  AUTOMATION_CONDITION,
  AUTOMATION_CONDITION_CRITERIA,
  AUTOMATION_SUBTASK,
  AUTOMATION_ROLE,
  AUTOMATION_GROUP,
  AUTOMATION_EMAIL_RECIPENT,
  PROJECT_TYPE,
  SECURITY_LEVEL_TYPE,
  SECURITY_SCHEME_TYPE,
  STATUS_TYPE_NAME,
  WORKFLOW_TYPE_NAME,
  AUTOMATION_COMPARE_VALUE,
  AUTOMATION_TYPE,
  AUTOMATION_LABEL_TYPE,
  GROUP_TYPE_NAME,
  PRIORITY_SCHEME_TYPE_NAME,
  SCRIPT_RUNNER_TYPE,
  POST_FUNCTION_CONFIGURATION,
  RESOLUTION_TYPE_NAME,
  ISSUE_EVENT_TYPE_NAME,
  CONDITION_CONFIGURATION,
  PROJECT_ROLE_TYPE,
  VALIDATOR_CONFIGURATION,
  BOARD_TYPE_NAME,
  ISSUE_LINK_TYPE_NAME,
  DIRECTED_LINK_TYPE,
  MAIL_LIST_TYPE_NAME,
  SCRIPT_RUNNER_LISTENER_TYPE,
  SCRIPTED_FIELD_TYPE,
  BEHAVIOR_TYPE,
  ISSUE_LAYOUT_TYPE,
  SCRIPT_RUNNER_SETTINGS_TYPE,
  SCRIPT_FRAGMENT_TYPE,
  CUSTOMER_PERMISSIONS_TYPE,
  QUEUE_TYPE,
  REQUEST_TYPE_NAME,
  CALENDAR_TYPE,
  PORTAL_GROUP_TYPE,
  PORTAL_SETTINGS_TYPE_NAME,
  SLA_TYPE_NAME,
  ISSUE_VIEW_TYPE,
  REQUEST_FORM_TYPE,
  OBJECT_TYPE_ATTRIBUTE_TYPE,
  OBJECT_TYPE_TYPE,
  SCREEN_TYPE_NAME,
  WEBHOOK_TYPE,
  OBJECT_SCHMEA_REFERENCE_TYPE_TYPE,
  OBJECT_SCHMEA_DEFAULT_REFERENCE_TYPE_TYPE,
  WORKFLOW_CONFIGURATION_TYPE,
  DELETE_LINK_TYPES,
  OBJECT_SCHEMA_TYPE,
  OBJECT_TYPE_ICON_TYPE,
  OBJECT_SCHEMA_STATUS_TYPE,
} from './constants'
import { getFieldsLookUpName } from './filters/fields/field_type_references_filter'
import { getRefType } from './references/workflow_properties'
import { FIELD_TYPE_NAME } from './filters/fields/constants'
import {
  gadgetValuesContextFunc,
  gadgetValueSerialize,
  gadgetDashboradValueLookup,
} from './references/dashboard_gadget_properties'

const { awu } = collections.asynciterable
const { neighborContextGetter, basicLookUp } = referenceUtils

const neighborContextFunc = (args: {
  contextFieldName: string
  levelsUp?: number
  contextValueMapper?: referenceUtils.ContextValueMapperFunc
  getLookUpName?: GetLookupNameFunc
}): referenceUtils.ContextFunc =>
  neighborContextGetter({
    getLookUpName: async ({ ref }) => ref.elemID.name,
    ...args,
  })

const toTypeName: referenceUtils.ContextValueMapperFunc = val => {
  if (val === 'issuetype') {
    return ISSUE_TYPE_NAME
  }
  return _.capitalize(val)
}

const toReferenceTypeTypeName: referenceUtils.ContextValueMapperFunc = val => {
  // 1,2,3,4,5,8 are the default values for the reference type field in jira.
  const defaultVals = new Set(['1', '2', '3', '4', '5', '8'])
  if (defaultVals.has(val)) {
    return OBJECT_SCHMEA_DEFAULT_REFERENCE_TYPE_TYPE
  }
  return OBJECT_SCHMEA_REFERENCE_TYPE_TYPE
}

export const resolutionAndPriorityToTypeName: referenceUtils.ContextValueMapperFunc = val => {
  if (val === 'priority' || val === 'resolution') {
    return _.capitalize(val)
  }
  return undefined
}

export type ReferenceContextStrategyName =
  | 'parentSelectedFieldType'
  | 'parentFieldType'
  | 'workflowStatusPropertiesContext'
  | 'parentFieldId'
  | 'parentField'
  | 'gadgetPropertyValue'
  | 'referenceTypeTypeName'

export const contextStrategyLookup: Record<ReferenceContextStrategyName, referenceUtils.ContextFunc> = {
  parentSelectedFieldType: neighborContextFunc({
    contextFieldName: 'selectedFieldType',
    levelsUp: 1,
    contextValueMapper: toTypeName,
  }),
  parentFieldType: neighborContextFunc({ contextFieldName: 'fieldType', levelsUp: 1, contextValueMapper: toTypeName }),
  workflowStatusPropertiesContext: neighborContextFunc({ contextFieldName: 'key', contextValueMapper: getRefType }),
  parentFieldId: neighborContextFunc({
    contextFieldName: 'fieldId',
    contextValueMapper: resolutionAndPriorityToTypeName,
  }),
  parentField: neighborContextFunc({
    contextFieldName: 'field',
    contextValueMapper: resolutionAndPriorityToTypeName,
  }),
  gadgetPropertyValue: gadgetValuesContextFunc,
  referenceTypeTypeName: neighborContextFunc({
    contextFieldName: 'additionalValue',
    contextValueMapper: toReferenceTypeTypeName,
  }),
}

const groupNameSerialize: GetLookupNameFunc = ({ ref }) =>
  ref.elemID.typeName === GROUP_TYPE_NAME ? ref.value.value.originalName : ref.value.value.id

const groupIdSerialize: GetLookupNameFunc = ({ ref }) =>
  isInstanceElement(ref.value) ? ref.value.value.groupId : ref.value

type JiraReferenceSerializationStrategyName =
  | 'groupStrategyById'
  | 'groupStrategyByOriginalName'
  | 'groupId'
  | 'key'
  | 'dashboradGadgetsValues'
type JiraReferenceIndexName = 'originalName' | 'groupId' | 'key'
const JiraReferenceSerializationStrategyLookup: Record<
  JiraReferenceSerializationStrategyName | referenceUtils.ReferenceSerializationStrategyName,
  referenceUtils.ReferenceSerializationStrategy<JiraReferenceIndexName>
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
  dashboradGadgetsValues: {
    // DashboardGadgets references are resolved in gadgetProperties filter
    serialize: gadgetValueSerialize,
    lookup: gadgetDashboradValueLookup,
    lookupIndexName: 'id',
  },
}

type JiraFieldReferenceDefinition = referenceUtils.FieldReferenceDefinition<
  ReferenceContextStrategyName,
  JiraReferenceSerializationStrategyName
>
export class JiraFieldReferenceResolver extends referenceUtils.FieldReferenceResolver<
  ReferenceContextStrategyName,
  JiraReferenceSerializationStrategyName,
  JiraReferenceIndexName
> {
  constructor(def: JiraFieldReferenceDefinition) {
    super(
      { ...def, sourceTransformation: def.sourceTransformation ?? 'asString' },
      JiraReferenceSerializationStrategyLookup,
    )
  }
}

export const referencesRules: JiraFieldReferenceDefinition[] = [
  {
    src: {
      field: 'issueTypeId',
      parentTypes: [
        'IssueTypeScreenSchemeItem',
        'FieldConfigurationIssueTypeItem',
        SCRIPT_RUNNER_TYPE,
        REQUEST_TYPE_NAME,
      ],
    },
    serializationStrategy: 'id',
    // No missing references strategy - field can be a string
    target: { type: ISSUE_TYPE_NAME },
  },
  {
    src: { field: 'fieldConfigurationId', parentTypes: ['FieldConfigurationIssueTypeItem'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: 'FieldConfiguration' },
  },
  {
    src: { field: 'screenSchemeId', parentTypes: ['IssueTypeScreenSchemeItem'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: 'ScreenScheme' },
  },
  {
    src: { field: 'defaultIssueTypeId', parentTypes: [ISSUE_TYPE_SCHEMA_NAME] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: ISSUE_TYPE_NAME },
  },
  {
    src: { field: 'issueTypeIds', parentTypes: [ISSUE_TYPE_SCHEMA_NAME, 'CustomFieldContext'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
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
    missingRefStrategy: 'typeAndValue',
    target: { type: STATUS_TYPE_NAME },
  },
  {
    src: { field: 'statusReference', parentTypes: ['WorkflowReferenceStatus'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: STATUS_TYPE_NAME },
  },
  {
    src: { field: 'statusReference', parentTypes: ['WorkflowStatusAndPort'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: STATUS_TYPE_NAME },
  },
  {
    src: { field: 'issueTypeId', parentTypes: ['StatusMappingDTO'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: ISSUE_TYPE_NAME },
  },
  {
    src: { field: 'projectId', parentTypes: ['StatusMappingDTO'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: PROJECT_TYPE },
  },
  {
    src: { field: 'oldStatusReference', parentTypes: ['StatusMigration'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: STATUS_TYPE_NAME },
  },
  {
    src: { field: 'newStatusReference', parentTypes: ['StatusMigration'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: STATUS_TYPE_NAME },
  },
  {
    src: { field: 'roleIds', parentTypes: ['WorkflowRuleConfiguration_parameters'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: PROJECT_ROLE_TYPE },
  },
  {
    src: { field: 'roleId', parentTypes: ['WorkflowRuleConfiguration_parameters'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: PROJECT_ROLE_TYPE },
  },
  {
    src: { field: 'issueSecurityLevelId', parentTypes: ['WorkflowRuleConfiguration_parameters'] },
    serializationStrategy: 'id',
    target: { type: SECURITY_LEVEL_TYPE },
  },
  {
    src: { field: 'fieldId', parentTypes: ['WorkflowRuleConfiguration_parameters'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: FIELD_TYPE_NAME },
  },
  {
    src: { field: 'sourceFieldKey', parentTypes: ['WorkflowRuleConfiguration_parameters'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: FIELD_TYPE_NAME },
  },
  {
    src: { field: 'targetFieldKey', parentTypes: ['WorkflowRuleConfiguration_parameters'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: FIELD_TYPE_NAME },
  },
  {
    src: { field: 'webhookId', parentTypes: ['WorkflowRuleConfiguration_parameters'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: WEBHOOK_TYPE },
  },
  {
    src: { field: 'field', parentTypes: ['WorkflowRuleConfiguration_parameters'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: FIELD_TYPE_NAME },
  },
  {
    src: { field: 'denyUserCustomFields', parentTypes: ['WorkflowRuleConfiguration_parameters'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: FIELD_TYPE_NAME },
  },
  {
    src: { field: 'groupCustomFields', parentTypes: ['WorkflowRuleConfiguration_parameters'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: FIELD_TYPE_NAME },
  },
  {
    src: { field: 'groupIds', parentTypes: ['WorkflowRuleConfiguration_parameters'] },
    serializationStrategy: 'groupId',
    missingRefStrategy: 'typeAndValue',
    target: { type: GROUP_TYPE_NAME },
  },
  {
    src: { field: 'statusIds', parentTypes: ['WorkflowRuleConfiguration_parameters'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: STATUS_TYPE_NAME },
  },
  {
    src: { field: 'previousStatusIds', parentTypes: ['WorkflowRuleConfiguration_parameters'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: STATUS_TYPE_NAME },
  },
  {
    src: { field: 'fromStatusId', parentTypes: ['WorkflowRuleConfiguration_parameters'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: STATUS_TYPE_NAME },
  },
  {
    src: { field: 'toStatusId', parentTypes: ['WorkflowRuleConfiguration_parameters'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: STATUS_TYPE_NAME },
  },
  {
    src: { field: 'screenId', parentTypes: ['WorkflowRuleConfiguration_parameters'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: SCREEN_TYPE_NAME },
  },
  {
    src: { field: 'date1FieldKey', parentTypes: ['WorkflowRuleConfiguration_parameters'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: FIELD_TYPE_NAME },
  },
  {
    src: { field: 'date2FieldKey', parentTypes: ['WorkflowRuleConfiguration_parameters'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: FIELD_TYPE_NAME },
  },
  {
    src: { field: 'fieldKey', parentTypes: ['WorkflowRuleConfiguration_parameters'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: FIELD_TYPE_NAME },
  },
  {
    src: { field: 'fieldsRequired', parentTypes: ['WorkflowRuleConfiguration_parameters'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: FIELD_TYPE_NAME },
  },
  {
    src: { field: 'groupsExemptFromValidation', parentTypes: ['WorkflowRuleConfiguration_parameters'] },
    serializationStrategy: 'groupId',
    missingRefStrategy: 'typeAndValue',
    target: { type: GROUP_TYPE_NAME },
  },
  {
    src: { field: 'value', parentTypes: ['WorkflowRuleConfiguration_parameters'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { typeContext: 'parentField' },
  },
  {
    src: { field: 'customIssueEventId', parentTypes: ['WorkflowTransitions'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: ISSUE_EVENT_TYPE_NAME },
  },
  {
    src: { field: 'id', parentTypes: ['TransitionScreenDetails'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: 'Screen' },
  },
  {
    src: { field: 'to', parentTypes: ['Transition'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: STATUS_TYPE_NAME },
  },
  {
    src: { field: 'from', parentTypes: ['Transition'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: STATUS_TYPE_NAME },
  },
  {
    src: { field: 'id', parentTypes: ['TransitionFrom'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: STATUS_TYPE_NAME },
  },
  {
    src: { field: 'id', parentTypes: ['ProjectRoleConfig'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: 'ProjectRole' },
  },
  {
    src: { field: 'fieldId', parentTypes: [POST_FUNCTION_CONFIGURATION] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: 'Field' },
  },
  {
    src: { field: 'destinationFieldId', parentTypes: [POST_FUNCTION_CONFIGURATION] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: 'Field' },
  },
  {
    src: { field: 'sourceFieldId', parentTypes: [POST_FUNCTION_CONFIGURATION] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: 'Field' },
  },
  {
    src: { field: 'date1', parentTypes: [VALIDATOR_CONFIGURATION] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: 'Field' },
  },
  {
    src: { field: 'date2', parentTypes: [VALIDATOR_CONFIGURATION] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: 'Field' },
  },
  {
    src: { field: 'fieldIds', parentTypes: [VALIDATOR_CONFIGURATION] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: 'Field' },
  },
  {
    src: { field: 'fieldId', parentTypes: [VALIDATOR_CONFIGURATION] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: 'Field' },
  },
  {
    src: { field: 'id', parentTypes: ['StatusRef'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: STATUS_TYPE_NAME },
  },
  {
    src: { field: 'parameter', parentTypes: ['PermissionHolder'] },
    serializationStrategy: 'id',
    // No missing references strategy - field can be a string
    target: { type: 'Field' },
  },
  {
    src: { field: 'parameter', parentTypes: ['PermissionHolder'] },
    serializationStrategy: 'id',
    // No missing references strategy - field can be a string
    target: { type: 'ProjectRole' },
  },
  {
    src: { field: 'id', parentTypes: ['ProjectPermission'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: 'Project' },
  },
  {
    src: { field: 'id', parentTypes: ['ProjectRolePermission'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: 'ProjectRole' },
  },
  {
    src: { field: 'filterId', parentTypes: ['Board'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: 'Filter' },
  },
  {
    src: { field: 'workflowScheme', parentTypes: ['Project'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: 'WorkflowScheme' },
  },
  {
    src: { field: 'issueTypeScreenScheme', parentTypes: ['Project'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: 'IssueTypeScreenScheme' },
  },
  {
    src: { field: 'fieldConfigurationScheme', parentTypes: ['Project'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: 'FieldConfigurationScheme' },
  },
  {
    src: { field: 'issueTypeScheme', parentTypes: ['Project'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: ISSUE_TYPE_SCHEMA_NAME },
  },
  {
    src: { field: 'permissionScheme', parentTypes: ['Project'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: 'PermissionScheme' },
  },
  {
    src: { field: 'notificationScheme', parentTypes: ['Project'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: 'NotificationScheme' },
  },
  {
    src: { field: 'issueSecurityScheme', parentTypes: ['Project'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: 'SecurityScheme' },
  },
  {
    src: { field: 'priorityScheme', parentTypes: ['Project'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: PRIORITY_SCHEME_TYPE_NAME },
  },
  {
    src: { field: 'fields', parentTypes: ['ScreenableTab'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
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
    missingRefStrategy: 'typeAndValue',
    target: { type: 'Project' },
  },
  {
    src: { field: 'projectKeyOrId', parentTypes: ['Board_location'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: 'Project' },
  },
  {
    src: { field: 'edit', parentTypes: ['ScreenTypes'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: 'Screen' },
  },
  {
    src: { field: 'create', parentTypes: ['ScreenTypes'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: 'Screen' },
  },
  {
    src: { field: 'view', parentTypes: ['ScreenTypes'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: 'Screen' },
  },
  {
    src: { field: 'default', parentTypes: ['ScreenTypes'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
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
    src: { field: 'workflow', parentTypes: ['WorkflowSchemeItem'] },
    serializationStrategy: 'name',
    missingRefStrategy: 'typeAndValue',
    target: { type: WORKFLOW_CONFIGURATION_TYPE },
  },
  {
    src: { field: 'defaultWorkflow', parentTypes: ['WorkflowScheme'] },
    serializationStrategy: 'name',
    missingRefStrategy: 'typeAndValue',
    target: { type: WORKFLOW_CONFIGURATION_TYPE },
  },
  {
    src: { field: 'issueType', parentTypes: ['WorkflowSchemeItem'] },
    serializationStrategy: 'id',
    target: { type: ISSUE_TYPE_NAME },
  },
  {
    src: { field: 'statusId', parentTypes: ['StatusMapping'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: STATUS_TYPE_NAME },
  },
  {
    src: { field: 'newStatusId', parentTypes: ['StatusMapping'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: STATUS_TYPE_NAME },
  },
  {
    src: { field: 'issueTypeId', parentTypes: ['StatusMapping'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: ISSUE_TYPE_NAME },
  },
  {
    src: { field: 'field', parentTypes: [BOARD_ESTIMATION_TYPE, MAIL_LIST_TYPE_NAME] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: 'Field' },
  },
  {
    src: { field: 'timeTracking', parentTypes: [BOARD_ESTIMATION_TYPE] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: 'Field' },
  },
  {
    src: { field: 'rankCustomFieldId', parentTypes: ['BoardConfiguration_ranking'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: 'Field' },
  },
  {
    src: { field: 'statusCategory', parentTypes: [STATUS_TYPE_NAME] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: 'StatusCategory' },
  },
  {
    src: { field: 'defaultLevel', parentTypes: [SECURITY_SCHEME_TYPE] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: SECURITY_LEVEL_TYPE },
  },
  {
    src: { field: 'projectId', parentTypes: [AUTOMATION_PROJECT_TYPE] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: PROJECT_TYPE },
  },
  {
    src: { field: 'statuses', parentTypes: ['BoardConfiguration_columnConfig_columns'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: STATUS_TYPE_NAME },
  },
  {
    src: { field: 'id', parentTypes: ['PostFunctionEvent'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: 'IssueEvent' },
  },
  {
    src: { field: 'eventType', parentTypes: ['NotificationSchemeEvent'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: 'IssueEvent' },
  },
  {
    src: { field: 'fieldId', parentTypes: ['ConditionConfiguration'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: 'Field' },
  },
  {
    src: { field: 'groups', parentTypes: ['ConditionConfiguration'] },
    serializationStrategy: 'groupStrategyByOriginalName',
    missingRefStrategy: 'typeAndValue',
    target: { type: GROUP_TYPE_NAME },
  },
  {
    src: { field: 'group', parentTypes: ['ConditionConfiguration', MAIL_LIST_TYPE_NAME] },
    serializationStrategy: 'groupStrategyByOriginalName',
    missingRefStrategy: 'typeAndValue',
    target: { type: GROUP_TYPE_NAME },
  },
  {
    src: { field: 'id', parentTypes: ['ConditionStatus'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: 'Status' },
  },
  {
    src: { field: 'id', parentTypes: ['ConditionProjectRole'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: 'ProjectRole' },
  },
  {
    src: { field: 'groups', parentTypes: ['ApplicationRole'] },
    serializationStrategy: 'groupStrategyByOriginalName',
    missingRefStrategy: 'typeAndValue',
    target: { type: GROUP_TYPE_NAME },
  },
  {
    src: { field: 'defaultGroups', parentTypes: ['ApplicationRole'] },
    serializationStrategy: 'groupStrategyByOriginalName',
    missingRefStrategy: 'typeAndValue',
    target: { type: GROUP_TYPE_NAME },
  },
  {
    src: { field: 'parameter', parentTypes: ['PermissionHolder'] },
    serializationStrategy: 'groupStrategyByOriginalName',
    // No missing references strategy - field can be a string
    target: { type: GROUP_TYPE_NAME },
  },
  {
    src: { field: 'name', parentTypes: ['GroupName'] },
    serializationStrategy: 'groupStrategyByOriginalName',
    missingRefStrategy: 'typeAndValue',
    target: { type: GROUP_TYPE_NAME },
  },
  {
    src: { field: 'groupName', parentTypes: [SCRIPT_RUNNER_TYPE] },
    serializationStrategy: 'groupStrategyByOriginalName',
    missingRefStrategy: 'typeAndValue',
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
    src: { field: 'id', parentTypes: [DELETE_LINK_TYPES] },
    serializationStrategy: 'id',
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
    missingRefStrategy: 'typeAndValue',
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
    serializationStrategy: 'groupStrategyByOriginalName',
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
    serializationStrategy: 'groupStrategyByOriginalName',
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
    missingRefStrategy: 'typeAndValue',
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
    serializationStrategy: 'groupStrategyById',
    target: { typeContext: 'workflowStatusPropertiesContext' },
  },
  {
    src: { field: 'value', parentTypes: ['WorkflowProperty'] },
    serializationStrategy: 'groupStrategyByOriginalName',
    target: { typeContext: 'workflowStatusPropertiesContext' },
  },
  {
    src: { field: 'value', parentTypes: ['WorkflowReferenceStatus_properties'] },
    serializationStrategy: 'groupStrategyById',
    target: { typeContext: 'workflowStatusPropertiesContext' },
  },
  {
    src: { field: 'value', parentTypes: ['WorkflowReferenceStatus_properties'] },
    serializationStrategy: 'groupStrategyByOriginalName',
    target: { typeContext: 'workflowStatusPropertiesContext' },
  },
  {
    src: { field: 'value', parentTypes: ['WorkflowTransitions_properties'] },
    serializationStrategy: 'groupStrategyById',
    target: { typeContext: 'workflowStatusPropertiesContext' },
  },
  {
    src: { field: 'value', parentTypes: ['WorkflowTransitions_properties'] },
    serializationStrategy: 'groupStrategyByOriginalName',
    target: { typeContext: 'workflowStatusPropertiesContext' },
  },
  {
    src: { field: 'optionIds', parentTypes: ['PriorityScheme'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: 'Priority' },
  },
  {
    src: { field: 'defaultOptionId', parentTypes: ['PriorityScheme'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: 'Priority' },
  },
  {
    src: { field: 'value', parentTypes: ['DashboardGadgetProperty'] },
    serializationStrategy: 'dashboradGadgetsValues',
    target: { typeContext: 'gadgetPropertyValue' },
  },
  {
    src: { field: 'groups', parentTypes: ['UserFilter'] },
    serializationStrategy: 'groupStrategyByOriginalName',
    missingRefStrategy: 'typeAndValue',
    target: { type: GROUP_TYPE_NAME },
  },
  {
    src: { field: 'roleIds', parentTypes: ['UserFilter'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: PROJECT_ROLE_TYPE },
  },
  {
    src: { field: 'roleId', parentTypes: [SCRIPT_RUNNER_TYPE] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: PROJECT_ROLE_TYPE },
  },
  {
    src: { field: 'FIELD_ROLE_ID', parentTypes: [POST_FUNCTION_CONFIGURATION] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: PROJECT_ROLE_TYPE },
  },
  {
    // for cloud
    src: { field: 'groupIds', parentTypes: ['CustomFieldContextDefaultValue'] },
    serializationStrategy: 'groupId',
    target: { type: GROUP_TYPE_NAME },
  },
  {
    // for cloud
    src: { field: 'groupId', parentTypes: ['CustomFieldContextDefaultValue'] },
    serializationStrategy: 'groupId',
    target: { type: GROUP_TYPE_NAME },
  },
  {
    // for DC
    src: { field: 'groupIds', parentTypes: ['CustomFieldContextDefaultValue'] },
    serializationStrategy: 'nameWithPath',
    missingRefStrategy: 'typeAndValue',
    target: { type: GROUP_TYPE_NAME },
  },
  {
    // for DC
    src: { field: 'groupId', parentTypes: ['CustomFieldContextDefaultValue'] },
    serializationStrategy: 'nameWithPath',
    missingRefStrategy: 'typeAndValue',
    target: { type: GROUP_TYPE_NAME },
  },
  {
    src: { field: 'projectId', parentTypes: ['CustomFieldContextDefaultValue'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: PROJECT_TYPE },
  },
  {
    src: { field: 'FIELD_RESOLUTION_ID', parentTypes: [POST_FUNCTION_CONFIGURATION] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: RESOLUTION_TYPE_NAME },
  },
  {
    src: { field: 'FIELD_EVENT_ID', parentTypes: [POST_FUNCTION_CONFIGURATION] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: ISSUE_EVENT_TYPE_NAME },
  },
  {
    src: { field: 'FIELD_TARGET_ISSUE_TYPE', parentTypes: [POST_FUNCTION_CONFIGURATION] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: ISSUE_TYPE_NAME },
  },
  {
    src: { field: 'FIELD_TARGET_FIELD_ID', parentTypes: [POST_FUNCTION_CONFIGURATION] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: FIELD_TYPE_NAME },
  },
  {
    src: { field: 'FIELD_SOURCE_FIELD_ID', parentTypes: [POST_FUNCTION_CONFIGURATION] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: FIELD_TYPE_NAME },
  },
  {
    src: { field: 'FIELD_TARGET_PROJECT', parentTypes: [POST_FUNCTION_CONFIGURATION] },
    serializationStrategy: 'key',
    missingRefStrategy: 'typeAndValue',
    target: { type: PROJECT_TYPE },
  },
  {
    src: { field: 'FIELD_SELECTED_FIELDS', parentTypes: [POST_FUNCTION_CONFIGURATION] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: FIELD_TYPE_NAME },
  },
  {
    src: { field: 'FIELD_SECURITY_LEVEL_ID', parentTypes: [POST_FUNCTION_CONFIGURATION] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: SECURITY_LEVEL_TYPE },
  },
  {
    src: { field: 'FIELD_BOARD_ID', parentTypes: [POST_FUNCTION_CONFIGURATION] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: BOARD_TYPE_NAME },
  },
  {
    src: { field: 'FIELD_STATUS_ID', parentTypes: [CONDITION_CONFIGURATION] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: STATUS_TYPE_NAME },
  },
  {
    src: { field: 'FIELD_LINKED_ISSUE_RESOLUTION', parentTypes: [CONDITION_CONFIGURATION] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: RESOLUTION_TYPE_NAME },
  },
  {
    src: { field: 'FIELD_PROJECT_ROLE_IDS', parentTypes: [CONDITION_CONFIGURATION] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: PROJECT_ROLE_TYPE },
  },
  {
    src: { field: 'FIELD_GROUP_NAMES', parentTypes: [CONDITION_CONFIGURATION] },
    serializationStrategy: 'groupStrategyByOriginalName',
    missingRefStrategy: 'typeAndValue',
    target: { type: GROUP_TYPE_NAME },
  },
  {
    src: { field: 'RESOLUTION_FIELD_NAME', parentTypes: [CONDITION_CONFIGURATION] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: RESOLUTION_TYPE_NAME },
  },
  {
    src: { field: 'FIELD_LINKED_ISSUE_STATUS', parentTypes: [CONDITION_CONFIGURATION] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: STATUS_TYPE_NAME },
  },
  {
    src: { field: 'FIELD_TEXT_FIELD', parentTypes: [CONDITION_CONFIGURATION, VALIDATOR_CONFIGURATION] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: FIELD_TYPE_NAME },
  },
  {
    src: { field: 'FIELD_USER_IN_FIELDS', parentTypes: [CONDITION_CONFIGURATION, VALIDATOR_CONFIGURATION] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: FIELD_TYPE_NAME },
  },
  {
    src: { field: 'FIELD_REQUIRED_FIELDS', parentTypes: [CONDITION_CONFIGURATION, VALIDATOR_CONFIGURATION] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: FIELD_TYPE_NAME },
  },
  {
    src: { field: 'FIELD_FIELD_IDS', parentTypes: [VALIDATOR_CONFIGURATION] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: FIELD_TYPE_NAME },
  },
  {
    src: { field: 'FIELD_FORM_FIELD', parentTypes: [VALIDATOR_CONFIGURATION] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: FIELD_TYPE_NAME },
  },
  {
    src: { field: 'linkType', parentTypes: [DIRECTED_LINK_TYPE] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: ISSUE_LINK_TYPE_NAME },
  },
  {
    src: { field: 'field', parentTypes: [MAIL_LIST_TYPE_NAME] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: FIELD_TYPE_NAME },
  },
  {
    src: { field: 'role', parentTypes: [MAIL_LIST_TYPE_NAME] },
    serializationStrategy: 'name',
    missingRefStrategy: 'typeAndValue',
    target: { type: PROJECT_ROLE_TYPE },
  },
  // ScriptRunner
  {
    src: { field: 'projects', parentTypes: [SCRIPT_RUNNER_LISTENER_TYPE] },
    serializationStrategy: 'key',
    missingRefStrategy: 'typeAndValue',
    target: { type: PROJECT_TYPE },
  },
  {
    src: { field: 'projectKeys', parentTypes: [SCRIPTED_FIELD_TYPE] },
    serializationStrategy: 'key',
    missingRefStrategy: 'typeAndValue',
    target: { type: PROJECT_TYPE },
  },
  {
    src: { field: 'issueTypes', parentTypes: [SCRIPTED_FIELD_TYPE] },
    serializationStrategy: 'name',
    missingRefStrategy: 'typeAndValue',
    target: { type: ISSUE_TYPE_NAME },
  },
  {
    src: { field: 'projectId', parentTypes: [REQUEST_FORM_TYPE, ISSUE_VIEW_TYPE] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: PROJECT_TYPE },
  },
  {
    src: { field: 'extraDefinerId', parentTypes: [ISSUE_LAYOUT_TYPE] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: 'Screen' },
  },
  {
    src: { field: 'key', parentTypes: ['issueLayoutItem'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: FIELD_TYPE_NAME },
  },
  {
    src: { field: 'affectedFields', parentTypes: ['Behavior__config'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: FIELD_TYPE_NAME },
  },
  {
    src: { field: 'projects', parentTypes: [BEHAVIOR_TYPE] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: PROJECT_TYPE },
  },
  {
    src: { field: 'issueTypes', parentTypes: [BEHAVIOR_TYPE] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: ISSUE_TYPE_NAME },
  },
  {
    src: { field: 'notifications_group@b', parentTypes: [SCRIPT_RUNNER_SETTINGS_TYPE] },
    serializationStrategy: 'groupStrategyByOriginalName',
    missingRefStrategy: 'typeAndValue',
    target: { type: GROUP_TYPE_NAME },
  },
  {
    src: { field: 'excluded_notifications_groups@b', parentTypes: [SCRIPT_RUNNER_SETTINGS_TYPE] },
    serializationStrategy: 'groupStrategyByOriginalName',
    missingRefStrategy: 'typeAndValue',
    target: { type: GROUP_TYPE_NAME },
  },
  {
    src: { field: 'entities', parentTypes: [SCRIPT_FRAGMENT_TYPE] },
    serializationStrategy: 'key',
    missingRefStrategy: 'typeAndValue',
    target: { type: PROJECT_TYPE },
  },
  {
    src: {
      field: 'projectKey',
      parentTypes: [
        CUSTOMER_PERMISSIONS_TYPE,
        QUEUE_TYPE,
        REQUEST_TYPE_NAME,
        PORTAL_GROUP_TYPE,
        CALENDAR_TYPE,
        PORTAL_SETTINGS_TYPE_NAME,
        SLA_TYPE_NAME,
        REQUEST_FORM_TYPE,
        ISSUE_VIEW_TYPE,
      ],
    },
    serializationStrategy: 'key',
    missingRefStrategy: 'typeAndValue',
    target: { type: PROJECT_TYPE },
  },
  {
    src: { field: 'ticketTypeIds', parentTypes: [PORTAL_GROUP_TYPE] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: REQUEST_TYPE_NAME },
  },
  {
    src: { field: 'id', parentTypes: ['RequestType__workflowStatuses'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: STATUS_TYPE_NAME },
  },
  {
    src: { field: 'columns', parentTypes: [QUEUE_TYPE] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: FIELD_TYPE_NAME },
  },
  {
    src: { field: 'calendarId', parentTypes: ['SLA__config__goals', 'SLA__config__goals__subGoals'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: CALENDAR_TYPE },
  },
  {
    src: { field: 'extraDefinerId', parentTypes: [REQUEST_FORM_TYPE, ISSUE_VIEW_TYPE] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: REQUEST_TYPE_NAME },
  },
  {
    src: { field: 'jiraField', parentTypes: ['Question'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: FIELD_TYPE_NAME },
  },
  {
    src: { field: 'parentObjectTypeId', parentTypes: [OBJECT_TYPE_TYPE] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: OBJECT_TYPE_TYPE },
  },
  {
    src: { field: 'objectType', parentTypes: [OBJECT_TYPE_ATTRIBUTE_TYPE] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: OBJECT_TYPE_TYPE },
  },
  {
    src: { field: 'typeValue', parentTypes: [OBJECT_TYPE_ATTRIBUTE_TYPE] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: OBJECT_TYPE_TYPE },
  },
  {
    src: { field: 'additionalValue', parentTypes: [OBJECT_TYPE_ATTRIBUTE_TYPE] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { typeContext: 'referenceTypeTypeName' },
  },
  {
    src: { field: 'objectTypeId', parentTypes: [AUTOMATION_COMPONENT_VALUE_TYPE] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: OBJECT_TYPE_TYPE },
  },
  {
    src: { field: 'schemaId', parentTypes: [AUTOMATION_COMPONENT_VALUE_TYPE] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: OBJECT_SCHEMA_TYPE },
  },
  {
    src: { field: 'requestType', parentTypes: [AUTOMATION_COMPONENT_VALUE_TYPE] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: REQUEST_TYPE_NAME },
  },
  {
    src: { field: 'portalRequestTypeIds', parentTypes: ['FormPortal'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: REQUEST_TYPE_NAME },
  },
  {
    src: { field: 'iconId', parentTypes: [OBJECT_TYPE_TYPE] },
    serializationStrategy: 'id',
    target: { type: OBJECT_TYPE_ICON_TYPE },
  },
  // typeValueMulti in ObjectTypeAttribute can be of different types.
  {
    src: { field: 'typeValueMulti', parentTypes: [OBJECT_TYPE_ATTRIBUTE_TYPE] },
    serializationStrategy: 'id',
    target: { type: STATUS_TYPE_NAME },
  },
  {
    src: { field: 'typeValueMulti', parentTypes: [OBJECT_TYPE_ATTRIBUTE_TYPE] },
    serializationStrategy: 'id',
    target: { type: OBJECT_SCHEMA_STATUS_TYPE },
  },
  {
    src: { field: 'typeValueMulti', parentTypes: [OBJECT_TYPE_ATTRIBUTE_TYPE] },
    serializationStrategy: 'groupStrategyByOriginalName',
    target: { type: GROUP_TYPE_NAME },
  },
  // Hack to handle missing references when the type is unknown
  {
    src: { field: 'typeValueMulti', parentTypes: [OBJECT_TYPE_ATTRIBUTE_TYPE] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: 'UnknownType' },
  },
]

const lookupNameFuncs: GetLookupNameFunc[] = [
  getFieldsLookUpName,
  // The second param is needed to resolve references by serializationStrategy
  referenceUtils.generateLookupFunc(referencesRules, defs => new JiraFieldReferenceResolver(defs)),
]

export const getLookUpName: GetLookupNameFunc = async args =>
  awu(lookupNameFuncs)
    .map(lookupFunc => lookupFunc(args))
    .find(res => !isReferenceExpression(res))
