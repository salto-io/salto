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
import { applicationValidator } from './application'
import { applicationFieldsValidator } from './application_addition_fields'
import { groupRuleStatusValidator } from './group_rule_status'
import { groupRuleActionsValidator } from './group_rule_actions'
import { defaultPoliciesValidator } from './default_policies'

export default (
): ChangeValidator => {
  const validators: ChangeValidator[] = [
    ...deployment.changeValidators.getDefaultChangeValidators(),
    applicationValidator,
    applicationFieldsValidator,
    groupRuleStatusValidator,
    groupRuleActionsValidator,
    defaultPoliciesValidator,
  ]

  return createChangeValidator(validators)
}
