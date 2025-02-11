/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
import { boardColumnConfigValidator } from './boards/board_column_config'
import { kanbanBoardBacklogValidator } from './boards/kanban_board_backlog'
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
import { workflowSchemeMigrationValidator } from './workflow_scheme_migration'
import { permissionSchemeDeploymentValidator } from './permission_scheme'
import { statusMigrationChangeValidator } from './status_migration'
import { activeSchemeChangeValidator } from './active_scheme_change'
import { activeSchemeDeletionValidator } from './active_scheme_deletion'
import { brokenReferenceValidator } from './broken_references'
import { unresolvedReferenceValidator } from './unresolved_references'
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
import { missingExtensionsTransitionRulesChangeValidator } from './workflowsV2/missing_extensions_transition_rules'
import { fieldContextOptionsValidator } from './field_contexts/field_context_options'
import { ISSUE_TYPE_NAME, PORTAL_GROUP_TYPE, PROJECT_TYPE, SCREEN_TYPE_NAME, SLA_TYPE_NAME } from '../constants'
import { assetsObjectFieldConfigurationAqlValidator } from './field_contexts/assets_object_field_configuration_aql'
import { projectAssigneeTypeValidator } from './projects/project_assignee_type'
import { FIELD_CONTEXT_OPTION_TYPE_NAME, FIELD_CONTEXT_TYPE_NAME } from '../filters/fields/constants'
import { fieldContextDefaultValueValidator } from './field_contexts/field_context_default_value'
import { fieldContextOrderRemovalValidator } from './field_contexts/order_removal'
import { optionValueValidator } from './field_contexts/option_value'
import { enhancedSearchDeploymentValidator } from './script_runner/enhanced_search_deployment'
import { emptyProjectScopedContextValidator } from './field_contexts/empty_project_scoped_context'
import { fieldValidator } from './field'
import { globalTransitionValidator } from './workflowsV2/global_transition'
import { htmlBodyContentValidator } from './automation/html_body_content'
import { systemGeneratedFieldsValidator } from './jsm/system_generated_fields'
import { automationIssueTypeValidator } from './automation/automations_issue_types'

const { deployTypesNotSupportedValidator, createChangeValidator, uniqueFieldsChangeValidatorCreator, SCOPE } =
  deployment.changeValidators

const TYPE_TO_UNIQUE_FIELD: Record<string, deployment.changeValidators.ScopeAndUniqueFields> = {
  [ISSUE_TYPE_NAME]: { scope: SCOPE.global, uniqueFields: ['name'] },
  [PORTAL_GROUP_TYPE]: { scope: SCOPE.parent, uniqueFields: ['name'] },
  [SLA_TYPE_NAME]: { scope: SCOPE.parent, uniqueFields: ['name'] },
  [PROJECT_TYPE]: { scope: SCOPE.global, uniqueFields: ['name', 'key'] },
  [FIELD_CONTEXT_TYPE_NAME]: { scope: SCOPE.parent, uniqueFields: ['name'] },
  [FIELD_CONTEXT_OPTION_TYPE_NAME]: { scope: SCOPE.parent, uniqueFields: ['value'] },
  [SCREEN_TYPE_NAME]: { scope: SCOPE.global, uniqueFields: ['name'] }
}

export default (client: JiraClient, config: JiraConfig, paginator: clientUtils.Paginator): ChangeValidator => {
  const validators: Record<ChangeValidatorName, ChangeValidator> = {
    ...deployment.changeValidators.getDefaultChangeValidators(['outgoingUnresolvedReferencesValidator']),
    uniqueFields: uniqueFieldsChangeValidatorCreator(TYPE_TO_UNIQUE_FIELD),
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
    referencedWorkflowDeletion: referencedWorkflowDeletionChangeValidator(config),
    statusMigrationChange: statusMigrationChangeValidator,
    missingExtensionsTransitionRules: missingExtensionsTransitionRulesChangeValidator(client),
    // Must run after statusMigrationChangeValidator
    workflowSchemeMigration: workflowSchemeMigrationValidator(client, config, paginator),
    workflowStatusMappings: workflowStatusMappingsValidator,
    inboundTransition: inboundTransitionChangeValidator,
    issueTypeSchemeMigration: issueTypeSchemeMigrationValidator(client),
    activeSchemeChange: activeSchemeChangeValidator(client),
    masking: maskingValidator(client),
    issueTypeDeletion: issueTypeDeletionValidator(client),
    lockedFields: lockedFieldsValidator,
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
    customFieldsWith10KOptions: customFieldsWith10KOptionValidator(config),
    issueTypeHierarchy: issueTypeHierarchyValidator,
    automationProjects: automationProjectsValidator,
    boardColumnConfig: boardColumnConfigValidator,
    deleteLastQueueValidator: deleteLastQueueValidator(config),
    defaultAdditionQueueValidator: defaultAdditionQueueValidator(config),
    automationToAssets: automationToAssetsValidator(config),
    defaultAttributeValidator: defaultAttributeValidator(config, client),
    addJsmProject: addJsmProjectValidator(client),
    deleteLabelAtttribute: deleteLabelAtttributeValidator(config),
    jsmPermissions: jsmPermissionsValidator(config, client),
    assetsObjectFieldConfigurationAql: assetsObjectFieldConfigurationAqlValidator(client),
    projectAssigneeType: projectAssigneeTypeValidator,
    fieldContextOptions: fieldContextOptionsValidator(config),
    fieldContextDefaultValue: fieldContextDefaultValueValidator(config),
    fieldContextOrderRemoval: fieldContextOrderRemovalValidator(config),
    optionValue: optionValueValidator(config),
    enhancedSearchDeployment: enhancedSearchDeploymentValidator,
    emptyProjectScopedContext: emptyProjectScopedContextValidator,
    field: fieldValidator,
    kanbanBoardBacklog: kanbanBoardBacklogValidator,
    globalTransition: globalTransitionValidator,
    htmlBodyContentAction: htmlBodyContentValidator,
    systemGeneratedFields: systemGeneratedFieldsValidator,
    automationIssueType: automationIssueTypeValidator(client),
  }

  return createChangeValidator({
    validators,
    validatorsActivationConfig: config.deploy.changeValidators,
  })
}
