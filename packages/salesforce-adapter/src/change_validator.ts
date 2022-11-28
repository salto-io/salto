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
import mapKeysValidator from './change_validators/map_keys'
import multipleDefaultsValidator from './change_validators/multiple_defaults'
import picklistPromoteValidator from './change_validators/picklist_promote'
import createCheckOnlyDeployValidator from './change_validators/check_only_deploy'
import cpqValidator from './change_validators/cpq_trigger'
import sbaaApprovalRulesCustomCondition from './change_validators/sbaa_approval_rules_custom_condition'
import recordTypeDeletionValidator from './change_validators/record_type_deletion'
import activeFlowValidator from './change_validators/active_flow_modifications'
import flowDeletionValidator from './change_validators/flow_deletion'
import fullNameChangedValidator from './change_validators/fullname_changed'

import { ChangeValidatorName, CheckOnlyChangeValidatorName, SalesforceConfig } from './types'

type ChangeValidatorCreator = (config: SalesforceConfig) => ChangeValidator
export const changeValidators: Record<ChangeValidatorName, ChangeValidatorCreator> = {
  managedPackage: () => packageValidator,
  picklistStandardField: () => picklistStandardFieldValidator,
  customObjectInstances: () => customObjectInstancesValidator,
  unknownField: () => unknownFieldValidator,
  customFieldType: () => customFieldTypeValidator,
  standardFieldLabel: () => standardFieldLabelValidator,
  mapKeys: () => mapKeysValidator,
  multipleDefaults: () => multipleDefaultsValidator,
  picklistPromote: () => picklistPromoteValidator,
  cpqValidator: () => cpqValidator,
  sbaaApprovalRulesCustomCondition: () => sbaaApprovalRulesCustomCondition,
  recordTypeDeletion: () => recordTypeDeletionValidator,
  activeFlowValidator: () => activeFlowValidator,
  flowDeletionValidator: () => flowDeletionValidator,
  fullNameChangedValidator: () => fullNameChangedValidator,
}

const checkOnlyChangeValidators
  : Record<CheckOnlyChangeValidatorName, ChangeValidatorCreator> = {
    checkOnlyDeploy: createCheckOnlyDeployValidator,
  }


const createSalesforceChangeValidator = ({ config, checkOnly }: {
  config: SalesforceConfig
  checkOnly: boolean
}): ChangeValidator => {
  const isCheckOnly = checkOnly || (config.client?.deploy?.checkOnly ?? false)
  const [activeValidators, disabledValidators] = _.partition(
    // SALTO-2700: Separate Validators
    Object.entries(isCheckOnly
      ? { ...checkOnlyChangeValidators, ...changeValidators }
      : changeValidators),
    ([name]) => config.validators?.[name as ChangeValidatorName] ?? true,
  )
  return createChangeValidator(
    activeValidators.map(([_name, validator]) => validator(config)),
    disabledValidators.map(([_name, validator]) => validator(config)),
  )
}
export default createSalesforceChangeValidator
