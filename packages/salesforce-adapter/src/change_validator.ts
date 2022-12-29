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
import omitDataValidator from './change_validators/omit_data'
import cpqValidator from './change_validators/cpq_trigger'
import sbaaApprovalRulesCustomCondition from './change_validators/sbaa_approval_rules_custom_condition'
import recordTypeDeletionValidator from './change_validators/record_type_deletion'
import flowsValidator from './change_validators/flows'
import fullNameChangedValidator from './change_validators/fullname_changed'
import invalidListViewFilterScope from './change_validators/invalid_listview_filterscope'
import caseAssignmentRulesValidator from './change_validators/case_assignmentRules'

import { ChangeValidatorName, CheckOnlyChangeValidatorName, SalesforceConfig } from './types'

type ChangeValidatorCreator = (config: SalesforceConfig, isSandbox: boolean) => ChangeValidator
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
  flowsValidator: (config, isSandbox) => flowsValidator(config, isSandbox),
  fullNameChangedValidator: () => fullNameChangedValidator,
  invalidListViewFilterScope: () => invalidListViewFilterScope,
  caseAssignmentRulesValidator: () => caseAssignmentRulesValidator,
}

export const validationChangeValidators
  : Record<CheckOnlyChangeValidatorName, ChangeValidatorCreator> = {
    omitData: omitDataValidator,
  }


const createSalesforceChangeValidator = ({ config, isSandbox, checkOnly }: {
  config: SalesforceConfig
  isSandbox: boolean
  checkOnly: boolean
}): ChangeValidator => {
  const isCheckOnly = checkOnly || (config.client?.deploy?.checkOnly ?? false)
  // SALTO-2700: Separate Validators
  const possibleValidationChangeValidators = isCheckOnly ? Object.entries(validationChangeValidators)
    : Object.entries(validationChangeValidators).filter(
      ([name]) => config.validators?.[name as ChangeValidatorName] !== undefined
    )
  const [activeValidators, disabledValidators] = _.partition(
    [...Object.entries(changeValidators), ...possibleValidationChangeValidators],
    ([name]) => config.validators?.[name as ChangeValidatorName] ?? true,
  )
  return createChangeValidator(
    activeValidators.map(([_name, validator]) => validator(config, isSandbox)),
    disabledValidators.map(([_name, validator]) => validator(config, isSandbox)),
  )
}
export default createSalesforceChangeValidator
