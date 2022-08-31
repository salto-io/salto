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
import _ from 'lodash'
import { ChangeValidator } from '@salto-io/adapter-api'
import { createChangeValidator } from '@salto-io/adapter-utils'
import packageValidator from './change_validators/package'
import picklistStandardFieldValidator from './change_validators/picklist_standard_field'
import customObjectInstancesValidator from './change_validators/custom_object_instances'
import unknownFieldValidator from './change_validators/unknown_field'
import customFieldTypeValidator from './change_validators/custom_field_type'
import standardFieldLabelValidator from './change_validators/standard_field_label'
import profileMapKeysValidator from './change_validators/profile_map_keys'
import multipleDefaultsValidator from './change_validators/multiple_defaults'
import picklistPromoteValidator from './change_validators/picklist_promote'
import createCheckOnlyDeployValidator from './change_validators/check_only_deploy'
import cpqValidator from './change_validators/cpq_trigger'
import sbaaApprovalRulesCustomCondition from './change_validators/sbaa_approval_rules_custom_condition'
import { ChangeValidatorName, CheckOnlyChangeValidatorName, SalesforceConfig } from './types'

type ChangeValidatorCreator = (config: SalesforceConfig) => ChangeValidator
export const changeValidators: Record<ChangeValidatorName, ChangeValidatorCreator> = {
  managedPackage: () => packageValidator,
  picklistStandardField: () => picklistStandardFieldValidator,
  customObjectInstances: () => customObjectInstancesValidator,
  unknownField: () => unknownFieldValidator,
  customFieldType: () => customFieldTypeValidator,
  standardFieldLabel: () => standardFieldLabelValidator,
  profileMapKeys: () => profileMapKeysValidator,
  multipleDefaults: () => multipleDefaultsValidator,
  picklistPromote: () => picklistPromoteValidator,
  cpqValidator: () => cpqValidator,
  sbaaApprovalRulesCustomCondition: () => sbaaApprovalRulesCustomCondition,
}

export const checkOnlyChangeValidators
    : Record<CheckOnlyChangeValidatorName, ChangeValidatorCreator> = {
      checkOnlyDeploy: createCheckOnlyDeployValidator,
    }


const createSalesforceChangeValidator = (
  config: SalesforceConfig,
  checkOnly: boolean
): ChangeValidator => {
  const [activeValidators, disabledValidators] = _.partition(
    Object.entries(checkOnly ? checkOnlyChangeValidators : changeValidators),
    ([name]) => config.validators?.[name as ChangeValidatorName] ?? true,
  )
  return createChangeValidator(
    activeValidators.map(([_name, validator]) => validator(config)),
    disabledValidators.map(([_name, validator]) => validator(config)),
  )
}
export default createSalesforceChangeValidator
