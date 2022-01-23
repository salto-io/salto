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
import { getFieldsLookUpName } from './filters/fields/field_type_references_filter'


export const referencesRules: referenceUtils.FieldReferenceDefinition<never>[] = [
  {
    src: { field: 'issueTypeId', parentTypes: ['IssueTypeScreenSchemeItem', 'FieldConfigurationIssueTypeItem'] },
    serializationStrategy: 'id',
    target: { type: 'IssueType' },
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
    src: { field: 'defaultIssueTypeId', parentTypes: ['IssueTypeScheme'] },
    serializationStrategy: 'id',
    target: { type: 'IssueType' },
  },
  {
    src: { field: 'issueTypeIds', parentTypes: ['IssueTypeScheme', 'CustomFieldContext'] },
    serializationStrategy: 'id',
    target: { type: 'IssueType' },
  },
  {
    src: { field: 'projectIds', parentTypes: ['CustomFieldContext'] },
    serializationStrategy: 'id',
    target: { type: 'Project' },
  },
  {
    src: { field: 'id', parentTypes: ['WorkflowStatus'] },
    serializationStrategy: 'id',
    target: { type: 'Status' },
  },
  {
    src: { field: 'id', parentTypes: ['TransitionScreenDetails'] },
    serializationStrategy: 'id',
    target: { type: 'Screen' },
  },
  {
    src: { field: 'to', parentTypes: ['Transition'] },
    serializationStrategy: 'id',
    target: { type: 'Status' },
  },
  {
    src: { field: 'from', parentTypes: ['Transition'] },
    serializationStrategy: 'id',
    target: { type: 'Status' },
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
    target: { type: 'Status' },
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
    target: { type: 'IssueTypeScheme' },
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
    target: { type: 'Workflow' },
  },
  {
    src: { field: 'workflow', parentTypes: ['WorkflowSchemeItem'] },
    serializationStrategy: 'name',
    target: { type: 'Workflow' },
  },
  {
    src: { field: 'issueType', parentTypes: ['WorkflowSchemeItem'] },
    serializationStrategy: 'id',
    target: { type: 'IssueType' },
  },
  {
    src: { field: 'statusId', parentTypes: ['StatusMigration'] },
    serializationStrategy: 'id',
    target: { type: 'Status' },
  },
  {
    src: { field: 'newStatusId', parentTypes: ['StatusMigration'] },
    serializationStrategy: 'id',
    target: { type: 'Status' },
  },
  {
    src: { field: 'issueTypeId', parentTypes: ['StatusMigration'] },
    serializationStrategy: 'id',
    target: { type: 'IssueType' },
  },
  {
    src: { field: 'fieldId', parentTypes: ['agile__1_0__board___boardId___configuration_estimation_field@uuvuuuu_00123_00125uuuu'] },
    serializationStrategy: 'id',
    target: { type: 'Field' },
  },
  {
    src: { field: 'rankCustomFieldId', parentTypes: ['agile__1_0__board___boardId___configuration_ranking@uuvuuuu_00123_00125uuu'] },
    serializationStrategy: 'id',
    target: { type: 'Field' },
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
