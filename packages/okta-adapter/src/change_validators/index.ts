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
import { ChangeValidator } from '@salto-io/adapter-api'
import { deployment } from '@salto-io/adapter-components'
import { applicationValidator } from './application'
import { groupRuleStatusValidator } from './group_rule_status'
import { groupRuleActionsValidator } from './group_rule_actions'
import { groupPushToApplicationUniquenessValidator } from './group_push_to_application_uniqueness'
import { defaultPoliciesValidator } from './default_policies'
import { customApplicationStatusValidator } from './custom_application_status'
import { appGroupValidator } from './app_group'
import { userTypeAndSchemaValidator } from './user_type_and_schema'
import { appIntegrationSetupValidator } from './app_integration_setup'
import { assignedAccessPoliciesValidator } from './assigned_policies'
import { groupSchemaModifyBaseValidator } from './group_schema_modify_base_fields'
import { enabledAuthenticatorsValidator } from './enabled_authenticators'
import { usersValidator } from './user'
import { appWithGroupPushValidator } from './app_with_group_push'
import { appUserSchemaWithInactiveAppValidator } from './app_schema_with_inactive_app'
import { appGroupAssignmentValidator } from './app_group_assignments'
import { appUrlsValidator } from './app_urls'
import { profileMappingRemovalValidator } from './profile_mapping_removal'
import { brandRemovalValidator } from './brand_removal'
import { appUserSchemaRemovalValidator } from './app_user_schema_removal'
import { domainAdditionValidator } from './domain_addition'
import { domainModificationValidator } from './domain_modification'
import OktaClient from '../client/client'
import {
  API_DEFINITIONS_CONFIG,
  ChangeValidatorName,
  DEPLOY_CONFIG,
  OktaConfig,
  PRIVATE_API_DEFINITIONS_CONFIG,
} from '../config'
import { dynamicOSVersionFeatureValidator } from './dynamic_os_version_feature'
import { brandThemeRemovalValidator } from './brand_theme_removal'

const { createCheckDeploymentBasedOnConfigValidator, getDefaultChangeValidators, createChangeValidator } =
  deployment.changeValidators

export default ({ client, config }: { client: OktaClient; config: OktaConfig }): ChangeValidator => {
  const validators: Record<ChangeValidatorName, ChangeValidator> = {
    ...getDefaultChangeValidators(),
    createCheckDeploymentBasedOnConfig: createCheckDeploymentBasedOnConfigValidator({
      typesConfig: _.merge(config[API_DEFINITIONS_CONFIG].types, config[PRIVATE_API_DEFINITIONS_CONFIG].types),
    }),
    application: applicationValidator,
    appGroup: appGroupValidator,
    groupRuleStatus: groupRuleStatusValidator,
    groupRuleActions: groupRuleActionsValidator,
    defaultPolicies: defaultPoliciesValidator,
    customApplicationStatus: customApplicationStatusValidator,
    userTypeAndSchema: userTypeAndSchemaValidator,
    appIntegrationSetup: appIntegrationSetupValidator(client),
    assignedAccessPolicies: assignedAccessPoliciesValidator,
    groupSchemaModifyBase: groupSchemaModifyBaseValidator,
    enabledAuthenticators: enabledAuthenticatorsValidator,
    users: usersValidator(client, config),
    appUserSchemaWithInactiveApp: appUserSchemaWithInactiveAppValidator,
    appWithGroupPush: appWithGroupPushValidator,
    groupPushToApplicationUniqueness: groupPushToApplicationUniquenessValidator,
    appGroupAssignment: appGroupAssignmentValidator,
    appUrls: appUrlsValidator,
    profileMappingRemoval: profileMappingRemovalValidator,
    brandRemoval: brandRemovalValidator,
    dynamicOSVersion: dynamicOSVersionFeatureValidator,
    brandThemeRemoval: brandThemeRemovalValidator,
    appUserSchemaRemoval: appUserSchemaRemovalValidator,
    domainAddition: domainAdditionValidator,
    domainModification: domainModificationValidator,
  }

  return createChangeValidator({
    validators,
    validatorsActivationConfig: config[DEPLOY_CONFIG]?.changeValidators,
  })
}
