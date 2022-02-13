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
import { ChangeValidator } from '@salto-io/adapter-api'
import { deployment } from '@salto-io/adapter-components'
import { createChangeValidator } from '@salto-io/adapter-utils'
import { unsupportedFieldConfigurationsValidator } from './field_configuration_unsupported_fields'
import { defaultFieldConfigurationValidator } from './default_field_configuration'
import { issueTypeSchemeValidator } from './issue_type_scheme'
import { screenValidator } from './screen'
import { workflowValidator } from './workflow'
import JiraClient from '../client/client'
import { JiraConfig } from '../config'
import { projectDeletionValidator } from './project_deletion'
import { statusValidator } from './status'

const {
  deployTypesNotSupportedValidator,
} = deployment.changeValidators


export default (
  client: JiraClient, config: JiraConfig
): ChangeValidator => {
  const validators: ChangeValidator[] = [
    deployTypesNotSupportedValidator,
    unsupportedFieldConfigurationsValidator,
    defaultFieldConfigurationValidator,
    workflowValidator,
    screenValidator,
    issueTypeSchemeValidator,
    projectDeletionValidator(client, config),
    statusValidator,
  ]

  return createChangeValidator(validators)
}
