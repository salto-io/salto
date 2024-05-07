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
import { ChangeValidator } from '@salto-io/adapter-api'
import { deployment, client as clientUtils } from '@salto-io/adapter-components'
import { readOnlyProjectRoleChangeValidator } from './read_only_project_role'
import { defaultFieldConfigurationValidator } from './field_configuration/default_field_configuration'
import { fieldConfigurationDescriptionLengthValidator } from './field_configuration/field_configuration_description_length'
import { fieldConfigurationItemDescriptionLengthValidator } from './field_configuration/field_configuration_item_description_length'
import { issueTypeSchemeValidator } from './issue_type_scheme'
import { screenValidator } from './screen'
import JiraClient from '../client/client'
import { ChangeValidatorName, JiraConfig } from '../config/config'
import { projectDeletionValidator } from './projects/project_deletion'
import { teamManagedProjectValidator } from './projects/team_managed_project'
import { statusValidator } from './status'
import { privateApiValidator } from './private_api'
import { readOnlyWorkflowValidator } from './workflows/read_only_workflow'
import { workflowStatusMappingsValidator } from './workflowsV2/status_mappings'
import { inboundTransitionChangeValidator } from './workflowsV2/inbound_transition'
import { dashboardGadgetsValidator } from './dashboard_gadgets'
import { dashboardLayoutValidator } from './dashboard_layout'
import { permissionTypeValidator } from './permission_type'
import { boardColumnConfigValidator } from './board_culomn_config'
import { maskingValidator } from './masking'
import { automationsValidator } from './automation/automations'
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
import { issueLayoutsValidator } from './issue_layouts_validator'
import { emptyValidatorWorkflowChangeValidator } from './workflows/empty_validator_workflow'
import { fieldContextValidator } from './field_contexts/field_contexts'
import { workflowSchemeMigrationValidator } from './workflow_scheme_migration'
import { permissionSchemeDeploymentValidator } from './permission_scheme'
import { statusMigrationChangeValidator } from './status_migration'
import { activeSchemeChangeValidator } from './active_scheme_change'
import { activeSchemeDeletionValidator } from './active_scheme_deletion'
import { brokenReferenceValidator } from './broken_references'
import { unresolvedReferenceValidator } from './unresolved_references'
import { sameIssueTypeNameChangeValidator } from './same_issue_type_name'
import { issueTypeSchemeMigrationValidator } from './issue_type_scheme_migration'
import { issueTypeDeletionValidator } from './issue_type_deletion'
import { projectCategoryValidator } from './projects/project_category'
import { fieldSecondGlobalContextValidator } from './field_contexts/second_global_context'
import { customFieldsWith10KOptionValidator } from './field_contexts/custom_field_with_10K_options'
import { issueTypeHierarchyValidator } from './issue_type_hierarchy'
import { automationProjectsValidator } from './automation/automation_projects'
import { deleteLastQueueValidator } from './last_queue'
import { deleteLabelAtttributeValidator } from './assets/label_attribute_removal'
import { defaultAdditionQueueValidator } from './default_addition_queue'
import { defaultAttributeValidator } from './assets/default_attribute'
import { automationToAssetsValidator } from './automation/automation_to_assets'
import { addJsmProjectValidator } from './adding_jsm_project'
import { jsmPermissionsValidator } from './jsm/jsm_permissions'
import { referencedWorkflowDeletionChangeValidator } from './workflowsV2/referenced_workflow_deletion'

const { deployTypesNotSupportedValidator, createChangeValidator } = deployment.changeValidators

export default (client: JiraClient, config: JiraConfig, paginator: clientUtils.Paginator): ChangeValidator => {
  const validators: Record<ChangeValidatorName, ChangeValidator> = {
    ...deployment.changeValidators.getDefaultChangeValidators(['outgoingUnresolvedReferencesValidator']),
    unresolvedReference: unresolvedReferenceValidator,
    brokenReferences: brokenReferenceValidator,
    deployTypesNotSupported: deployTypesNotSupportedValidator,
    readOnlyProjectRoleChange: readOnlyProjectRoleChangeValidator,
    defaultFieldConfiguration: defaultFieldConfigurationValidator,
    fieldConfigurationDescriptionLength: fieldConfigurationDescriptionLengthValidator,
    fieldConfigurationItemDescriptionLength: fieldConfigurationItemDescriptionLengthValidator,
    screen: screenValidator,
    issueTypeScheme: issueTypeSchemeValidator,
    issueTypeSchemeDefaultType: issueTypeSchemeDefaultTypeValidator,
    teamManagedProject: teamManagedProjectValidator(client),
    projectDeletion: projectDeletionValidator(client, config),
    status: statusValidator,
    privateApi: privateApiValidator(config),
    emptyValidatorWorkflowChange: emptyValidatorWorkflowChangeValidator,
    readOnlyWorkflow: readOnlyWorkflowValidator,
    dashboardGadgets: dashboardGadgetsValidator,
    issueLayouts: issueLayoutsValidator(client, config),
    dashboardLayout: dashboardLayoutValidator,
    permissionType: permissionTypeValidator,
    automations: automationsValidator,
    activeSchemeDeletion: activeSchemeDeletionValidator,
    sameIssueTypeNameChange: sameIssueTypeNameChangeValidator,
    referencedWorkflowDeletion: referencedWorkflowDeletionChangeValidator(config),
    statusMigrationChange: statusMigrationChangeValidator,
    // Must run after statusMigrationChangeValidator
    workflowSchemeMigration: workflowSchemeMigrationValidator(client, config, paginator),
    workflowStatusMappings: workflowStatusMappingsValidator,
    inboundTransition: inboundTransitionChangeValidator,
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
    customFieldsWith10KOptions: customFieldsWith10KOptionValidator,
    issueTypeHierarchy: issueTypeHierarchyValidator,
    automationProjects: automationProjectsValidator,
    boardColumnConfig: boardColumnConfigValidator,
    deleteLastQueueValidator: deleteLastQueueValidator(config),
    defaultAdditionQueueValidator: defaultAdditionQueueValidator(config),
    automationToAssets: automationToAssetsValidator(config),
    defaultAttributeValidator: defaultAttributeValidator(config, client),
    addJsmProject: addJsmProjectValidator,
    deleteLabelAtttribute: deleteLabelAtttributeValidator(config),
    jsmPermissions: jsmPermissionsValidator(config, client),
  }

  return createChangeValidator({
    validators,
    validatorsActivationConfig: config.deploy.changeValidators,
  })
}
