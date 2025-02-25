/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { ChangeValidator } from '@salto-io/adapter-api'
import { deployment, elements as elementsUtils, definitions as definitionUtils } from '@salto-io/adapter-components'
import { groupRuleActionsValidator } from './group_rule_actions'
import { groupPushToApplicationUniquenessValidator } from './group_push_to_application_uniqueness'
import { defaultPoliciesValidator } from './default_policies'
import { customApplicationStatusValidator } from './custom_application_status'
import { appGroupValidator } from './app_group'
import { userTypeAndSchemaValidator } from './user_type_and_schema'
import { appIntegrationSetupValidator } from './app_integration_setup'
import { assignedAccessPoliciesValidator } from './assigned_policies'
import { enabledAuthenticatorsValidator } from './enabled_authenticators'
import { usersValidator } from './user'
import { appWithGroupPushValidator } from './app_with_group_push'
import { appUserSchemaWithInactiveAppValidator } from './app_schema_with_inactive_app'
import { schemaBaseChangesValidator } from './app_user_schema_base_properties'
import { appGroupAssignmentValidator } from './app_group_assignments'
import { appUrlsValidator } from './app_urls'
import { profileMappingRemovalValidator } from './profile_mapping_removal'
import { brandRemovalValidator } from './brand_removal'
import { appUserSchemaRemovalValidator } from './app_user_schema_removal'
import { domainAdditionValidator } from './domain_addition'
import { domainModificationValidator } from './domain_modification'
import { dynamicOSVersionFeatureValidator } from './dynamic_os_version_feature'
import { brandDependentElementRemovalValidator } from './brand_dependent_element_removal'
import { userStatusValidator } from './user_status'
import { disabledAuthenticatorsInMfaPolicyValidator } from './disabled_authenticators_in_mfa'
import { oidcIdentityProviderValidator } from './oidc_idp'
import { everyoneGroupAssignments } from './everyone_group_assignments'
import { emailDomainAdditionValidator } from './email_domain_addition'
import { provisionedUserAdditions } from './provisioned_user_addition'
import OktaClient from '../client/client'
import {
  API_DEFINITIONS_CONFIG,
  DEPLOY_CONFIG,
  OldOktaDefinitionsConfig,
  PRIVATE_API_DEFINITIONS_CONFIG,
} from '../config'
import { OktaUserConfig, ChangeValidatorName } from '../user_config'
import { OktaOptions } from '../definitions/types'
import { BRAND_LOGO_TYPE_NAME, FAV_ICON_TYPE_NAME } from '../constants'
import { appGroupAssignmentProfileAttributesValidator } from './app_group_assignments_profile_attributes'
import { appProvisioningAdditionValidator } from './app_provisioning_addition'

const { createCheckDeploymentBasedOnDefinitionsValidator, getDefaultChangeValidators, createChangeValidator } =
  deployment.changeValidators

export default ({
  client,
  userConfig,
  fetchQuery,
  definitions,
  oldApiDefsConfig,
}: {
  client: OktaClient
  userConfig: OktaUserConfig
  fetchQuery: elementsUtils.query.ElementQuery
  definitions: definitionUtils.ApiDefinitions<OktaOptions>
  oldApiDefsConfig: OldOktaDefinitionsConfig
}): ChangeValidator => {
  const typesHandledByFilters = [FAV_ICON_TYPE_NAME, BRAND_LOGO_TYPE_NAME]
  const validators: Record<ChangeValidatorName, ChangeValidator> = {
    ...getDefaultChangeValidators(),
    createCheckDeploymentBasedOnDefinitions: createCheckDeploymentBasedOnDefinitionsValidator<OktaOptions>({
      deployDefinitions: definitions.deploy ?? { instances: {} },
      typesConfig: _.merge(
        oldApiDefsConfig[API_DEFINITIONS_CONFIG].types,
        oldApiDefsConfig[PRIVATE_API_DEFINITIONS_CONFIG].types,
      ),
      typesWithNoDeploy: typesHandledByFilters,
    }),
    appGroup: appGroupValidator,
    groupRuleActions: groupRuleActionsValidator,
    defaultPolicies: defaultPoliciesValidator,
    customApplicationStatus: customApplicationStatusValidator,
    userTypeAndSchema: userTypeAndSchemaValidator,
    appIntegrationSetup: appIntegrationSetupValidator(client),
    assignedAccessPolicies: assignedAccessPoliciesValidator,
    enabledAuthenticators: enabledAuthenticatorsValidator,
    users: usersValidator(client, userConfig, fetchQuery),
    appUserSchemaWithInactiveApp: appUserSchemaWithInactiveAppValidator,
    schemaBaseChanges: schemaBaseChangesValidator,
    appWithGroupPush: appWithGroupPushValidator,
    groupPushToApplicationUniqueness: groupPushToApplicationUniquenessValidator,
    appGroupAssignment: appGroupAssignmentValidator,
    appGroupAssignmentProfileAttributes: appGroupAssignmentProfileAttributesValidator,
    appUrls: appUrlsValidator,
    profileMappingRemoval: profileMappingRemovalValidator,
    brandRemoval: brandRemovalValidator,
    dynamicOSVersion: dynamicOSVersionFeatureValidator,
    brandDependentElementRemoval: brandDependentElementRemovalValidator,
    appUserSchemaRemoval: appUserSchemaRemovalValidator,
    domainAddition: domainAdditionValidator,
    domainModification: domainModificationValidator,
    userStatusChanges: userStatusValidator,
    disabledAuthenticatorsInMfaPolicy: disabledAuthenticatorsInMfaPolicyValidator,
    oidcIdentityProvider: oidcIdentityProviderValidator,
    everyoneGroupAssignments,
    emailDomainAddition: emailDomainAdditionValidator,
    provisionedUserAdditions,
    appProvisioningAddition: appProvisioningAdditionValidator,
  }

  return createChangeValidator({
    validators,
    validatorsActivationConfig: userConfig[DEPLOY_CONFIG]?.changeValidators,
  })
}
