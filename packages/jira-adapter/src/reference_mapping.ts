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
import { isReferenceExpression } from '@salto-io/adapter-api'
import { references as referenceUtils } from '@salto-io/adapter-components'
import { GetLookupNameFunc } from '@salto-io/adapter-utils'
import { ISSUE_TYPE_NAME, ISSUE_TYPE_SCHEMA_NAME, STATUS_TYPE_NAME, WORKFLOW_TYPE_NAME } from './constants'
import { getFieldsLookUpName } from './filters/fields/field_type_references_filter'


export const referencesRules: referenceUtils.FieldReferenceDefinition<never>[] = [
  {
    src: { field: 'issueTypeId', parentTypes: ['IssueTypeScreenSchemeItem', 'FieldConfigurationIssueTypeItem'] },
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
    src: { field: 'fieldId', parentTypes: ['PostFunctionConfiguration'] },
    serializationStrategy: 'id',
    target: { type: 'Field' },
  },
  {
    src: { field: 'destinationFieldId', parentTypes: ['PostFunctionConfiguration'] },
    serializationStrategy: 'id',
    target: { type: 'Field' },
  },
  {
    src: { field: 'sourceFieldId', parentTypes: ['PostFunctionConfiguration'] },
    serializationStrategy: 'id',
    target: { type: 'Field' },
  },
  {
    src: { field: 'date1', parentTypes: ['ValidatorConfiguration'] },
    serializationStrategy: 'id',
    target: { type: 'Field' },
  },
  {
    src: { field: 'date2', parentTypes: ['ValidatorConfiguration'] },
    serializationStrategy: 'id',
    target: { type: 'Field' },
  },
  {
    src: { field: 'fieldIds', parentTypes: ['ValidatorConfiguration'] },
    serializationStrategy: 'id',
    target: { type: 'Field' },
  },
  {
    src: { field: 'fieldId', parentTypes: ['ValidatorConfiguration'] },
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
    src: { field: 'projectId', parentTypes: ['Board_location'] },
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
    src: { field: 'fieldId', parentTypes: ['BoardConfiguration_estimation'] },
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
]

const lookupNameFuncs: GetLookupNameFunc[] = [
  getFieldsLookUpName,
  referenceUtils.generateLookupFunc(referencesRules),
]

export const getLookUpName: GetLookupNameFunc = async args => (
  lookupNameFuncs
    .map(lookupFunc => lookupFunc(args))
    .find(res => !isReferenceExpression(res))
)
