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
import { deployment, client as clientUtils } from '@salto-io/adapter-components'
import { readOnlyProjectRoleChangeValidator } from './read_only_project_role'
import { defaultFieldConfigurationValidator } from './default_field_configuration'
import { issueTypeSchemeValidator } from './issue_type_scheme'
import { screenValidator } from './screen'
import JiraClient from '../client/client'
import { ChangeValidatorName, JiraConfig } from '../config/config'
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
import { accountIdValidator } from './account_id'
import { screenSchemeDefaultValidator } from './screen_scheme_default'
import { workflowSchemeDupsValidator } from './workflows/workflow_scheme_dups'
import { workflowTransitionDuplicateNameValidator } from './workflows/workflow_transition_duplicate_names'
import { issueTypeSchemeDefaultTypeValidator } from './issue_type_scheme_default_type'
import { emptyValidatorWorkflowChangeValidator } from './workflows/empty_validator_workflow'
import { fieldContextValidator } from './field_contexts/field_contexts'
import { workflowSchemeMigrationValidator } from './workflow_scheme_migration'
import { permissionSchemeDeploymentValidator } from './permission_scheme'
import { statusMigrationChangeValidator } from './status_migration'
import { activeSchemeChangeValidator } from './active_scheme_change'
import { activeSchemeDeletionValidator } from './active_scheme_deletion'
import { automationProjectUnresolvedReferenceValidator } from './automation_unresolved_references'
import { unresolvedReferenceValidator } from './unresolved_references'
import { sameIssueTypeNameChangeValidator } from './same_issue_type_name'
import { issueTypeSchemeMigrationValidator } from './issue_type_scheme_migration'
import { issueTypeDeletionValidator } from './issue_type_deletion'
import { projectCategoryValidator } from './project_category'
import { unresolvedFieldConfigurationItemsValidator } from './unresolved_field_configuration_items'
import { fieldSecondGlobalContextValidator } from './field_contexts/second_global_context'

const {
  deployTypesNotSupportedValidator,
  createChangeValidator,
} = deployment.changeValidators


export default (
  client: JiraClient, config: JiraConfig, paginator: clientUtils.Paginator
): ChangeValidator => {
  const validators: Record<ChangeValidatorName, ChangeValidator> = {
    ...deployment.changeValidators.getDefaultChangeValidators(['outgoingUnresolvedReferencesValidator']),
    unresolvedReference: unresolvedReferenceValidator,
    automationProjectUnresolvedReference: automationProjectUnresolvedReferenceValidator,
    deployTypesNotSupported: deployTypesNotSupportedValidator,
    readOnlyProjectRoleChange: readOnlyProjectRoleChangeValidator,
    defaultFieldConfiguration: defaultFieldConfigurationValidator,
    screen: screenValidator,
    issueTypeScheme: issueTypeSchemeValidator,
    issueTypeSchemeDefaultType: issueTypeSchemeDefaultTypeValidator,
    projectDeletion: projectDeletionValidator(client, config),
    status: statusValidator,
    privateApi: privateApiValidator(config),
    emptyValidatorWorkflowChange: emptyValidatorWorkflowChangeValidator,
    readOnlyWorkflow: readOnlyWorkflowValidator,
    dashboardGadgets: dashboardGadgetsValidator,
    dashboardLayout: dashboardLayoutValidator,
    permissionType: permissionTypeValidator,
    automations: automationsValidator,
    activeSchemeDeletion: activeSchemeDeletionValidator,
    sameIssueTypeNameChange: sameIssueTypeNameChangeValidator,
    statusMigrationChange: statusMigrationChangeValidator,
    // Must run after statusMigrationChangeValidator
    workflowSchemeMigration: workflowSchemeMigrationValidator(client, config, paginator),
    issueTypeSchemeMigration: issueTypeSchemeMigrationValidator(client),
    activeSchemeChange: activeSchemeChangeValidator(client),
    masking: maskingValidator(client),
    issueTypeDeletion: issueTypeDeletionValidator(client),
    lockedFields: lockedFieldsValidator,
    fieldContext: fieldContextValidator,
    fieldSecondGlobalContext: fieldSecondGlobalContextValidator,
    systemFields: systemFieldsValidator,
    workflowProperties: workflowPropertiesValidator,
    permissionScheme: permissionSchemeValidator,
    screenSchemeDefault: screenSchemeDefaultValidator,
    wrongUserPermissionScheme: wrongUserPermissionSchemeValidator(client, config),
    accountId: accountIdValidator(client, config),
    workflowSchemeDups: workflowSchemeDupsValidator,
    workflowTransitionDuplicateName: workflowTransitionDuplicateNameValidator,
    permissionSchemeDeployment: permissionSchemeDeploymentValidator(client),
    projectCategory: projectCategoryValidator(client),
    unresolvedFieldConfigurationItems: unresolvedFieldConfigurationItemsValidator,
  }

  return createChangeValidator({
    validators,
    validatorsActivationConfig: config.deploy.changeValidators,
  })
}
