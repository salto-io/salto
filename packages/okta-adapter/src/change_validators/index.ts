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
import { ChangeValidator } from '@salto-io/adapter-api'
import { deployment } from '@salto-io/adapter-components'
import { createChangeValidator } from '@salto-io/adapter-utils'
import { applicationValidator } from './application'
import { groupRuleStatusValidator } from './group_rule_status'
import { groupRuleActionsValidator } from './group_rule_actions'
import { defaultPoliciesValidator } from './default_policies'
import { groupRuleAdministratorValidator } from './group_rule_administrator'
import { customApplicationStatusValidator } from './custom_application_status'
import { appGroupValidator } from './app_group'
import { userTypeAndSchemaValidator } from './user_type_and_schema'
import { appIntegrationSetupValidator } from './app_integration_setup'
import { assignedAccessPoliciesValidator } from './assigned_policies'
import { groupSchemaModifyBaseValidator } from './group_schema_modify_base_fields'
import { enabledAuthenticatorsValidator } from './enabled_authenticators'
import { roleAssignmentValidator } from './role_assignment'
import { usersValidator } from './user'
import OktaClient from '../client/client'
import { API_DEFINITIONS_CONFIG, OktaConfig, PRIVATE_API_DEFINITIONS_CONFIG } from '../config'
import { appUserSchemaWithInactiveAppValidator } from './app_schema_with_inactive_app'

const {
  createCheckDeploymentBasedOnConfigValidator,
  getDefaultChangeValidators,
} = deployment.changeValidators

export default ({
  client,
  config,
}: {
  client: OktaClient
  config: OktaConfig
}): ChangeValidator => {
  const validators: ChangeValidator[] = [
    ...getDefaultChangeValidators(),
    createCheckDeploymentBasedOnConfigValidator({
      typesConfig: _.merge(config[API_DEFINITIONS_CONFIG].types, config[PRIVATE_API_DEFINITIONS_CONFIG].types),
    }),
    applicationValidator,
    appGroupValidator,
    groupRuleStatusValidator,
    groupRuleActionsValidator,
    defaultPoliciesValidator,
    groupRuleAdministratorValidator,
    customApplicationStatusValidator,
    userTypeAndSchemaValidator,
    appIntegrationSetupValidator(client),
    assignedAccessPoliciesValidator,
    groupSchemaModifyBaseValidator,
    enabledAuthenticatorsValidator,
    roleAssignmentValidator,
    usersValidator(client, config),
    appUserSchemaWithInactiveAppValidator,
  ]

  return createChangeValidator(validators)
}
