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
import { ChangeValidator } from '@salto-io/adapter-api'
import { deployment } from '@salto-io/adapter-components'
import { createChangeValidator } from '@salto-io/adapter-utils'
import { readOnlyProjectRoleChangeValidator } from './read_only_project_role'
import { defaultFieldConfigurationValidator } from './default_field_configuration'
import { issueTypeSchemeValidator } from './issue_type_scheme'
import { screenValidator } from './screen'
import JiraClient from '../client/client'
import { JiraConfig } from '../config/config'
import { projectDeletionValidator } from './project_deletion'
import { statusValidator } from './status'
import { privateApiValidator } from './private_api'
import { readOnlyWorkflowValidator } from './workflows/read_only_workflow'
import { dashboardGadgetsValidator } from './dashboard_gadgets'
import { dashboardLayoutValidator } from './dashboard_layout'
import { permissionTypeValidator } from './permission_type'
import { maskingValidator } from './masking'
import { automationsValidator } from './automations'
import { lockedFieldsValidator } from './locked_fields'
import { systemFieldsValidator } from './system_fields'
import { workflowPropertiesValidator } from './workflows/workflow_properties'
import { permissionSchemeValidator } from './sd_portals_permission_scheme'
import { wrongUserPermissionSchemeValidator } from './wrong_user_permission_scheme'
import { GetUserMapFunc } from '../users'
import { accountIdValidator } from './account_id'
import { screenSchemeDefaultValidator } from './screen_scheme_default'
import { workflowSchemeDupsValidator } from './workflows/workflow_scheme_dups'
import { issueTypeSchemeDefaultTypeValidator } from './issue_type_scheme_default_type'
import { emptyValidatorWorkflowChangeValidator } from './workflows/empty_validator_workflow'
import { fieldContextValidator } from './field_contexts/field_contexts'
import { permissionSchemeDeploymentValidator } from './permission_scheme'

const {
  deployTypesNotSupportedValidator,
} = deployment.changeValidators


export default (
  client: JiraClient, config: JiraConfig, getUserMapFunc: GetUserMapFunc
): ChangeValidator => {
  const validators: ChangeValidator[] = [
    deployTypesNotSupportedValidator,
    readOnlyProjectRoleChangeValidator,
    defaultFieldConfigurationValidator,
    screenValidator,
    issueTypeSchemeValidator,
    issueTypeSchemeDefaultTypeValidator,
    projectDeletionValidator(client, config),
    statusValidator,
    privateApiValidator(config),
    emptyValidatorWorkflowChangeValidator,
    readOnlyWorkflowValidator,
    dashboardGadgetsValidator,
    dashboardLayoutValidator,
    permissionTypeValidator,
    automationsValidator,
    maskingValidator(client),
    lockedFieldsValidator,
    fieldContextValidator,
    systemFieldsValidator,
    workflowPropertiesValidator,
    permissionSchemeValidator,
    screenSchemeDefaultValidator,
    wrongUserPermissionSchemeValidator(client, config, getUserMapFunc),
    accountIdValidator(client, config, getUserMapFunc),
    workflowSchemeDupsValidator,
    permissionSchemeDeploymentValidator(client),
  ]

  return createChangeValidator(validators)
}
