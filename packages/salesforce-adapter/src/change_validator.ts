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
import unknownUser from './change_validators/unknown_users'
import SalesforceClient from './client/client'
import { ChangeValidatorName, SalesforceConfig } from './types'


type ChangeValidatorCreator = (config: SalesforceConfig,
                               isSandbox: boolean,
                               client: SalesforceClient) => ChangeValidator

type ChangeValidatorDefinition = {
  creator: ChangeValidatorCreator
  defaultInDeploy: boolean
  defaultInValidate: boolean
}

const defaultAlwaysRun = { defaultInDeploy: true, defaultInValidate: true }

export const changeValidators: Record<ChangeValidatorName, ChangeValidatorDefinition> = {
  managedPackage: { creator: () => packageValidator, ...defaultAlwaysRun },
  picklistStandardField: { creator: () => picklistStandardFieldValidator, ...defaultAlwaysRun },
  customObjectInstances: { creator: () => customObjectInstancesValidator, ...defaultAlwaysRun },
  unknownField: { creator: () => unknownFieldValidator, ...defaultAlwaysRun },
  customFieldType: { creator: () => customFieldTypeValidator, ...defaultAlwaysRun },
  standardFieldLabel: { creator: () => standardFieldLabelValidator, ...defaultAlwaysRun },
  mapKeys: { creator: () => mapKeysValidator, ...defaultAlwaysRun },
  multipleDefaults: { creator: () => multipleDefaultsValidator, ...defaultAlwaysRun },
  picklistPromote: { creator: () => picklistPromoteValidator, ...defaultAlwaysRun },
  cpqValidator: { creator: () => cpqValidator, ...defaultAlwaysRun },
  sbaaApprovalRulesCustomCondition: { creator: () => sbaaApprovalRulesCustomCondition, ...defaultAlwaysRun },
  recordTypeDeletion: { creator: () => recordTypeDeletionValidator, ...defaultAlwaysRun },
  flowsValidator: { creator: (config, isSandbox) => flowsValidator(config, isSandbox), ...defaultAlwaysRun },
  fullNameChangedValidator: { creator: () => fullNameChangedValidator, ...defaultAlwaysRun },
  invalidListViewFilterScope: { creator: () => invalidListViewFilterScope, ...defaultAlwaysRun },
  caseAssignmentRulesValidator: { creator: () => caseAssignmentRulesValidator, ...defaultAlwaysRun },
  omitData: { creator: omitDataValidator, defaultInDeploy: false, defaultInValidate: true },
  unknownUser: { creator: (_config, _isSandbox, client) => unknownUser(client), ...defaultAlwaysRun },
}

const createSalesforceChangeValidator = ({ config, isSandbox, checkOnly, client }: {
  config: SalesforceConfig
  isSandbox: boolean
  checkOnly: boolean
  client: SalesforceClient
}): ChangeValidator => {
  const isCheckOnly = checkOnly || (config.client?.deploy?.checkOnly ?? false)
  const activeValidators = Object.entries(changeValidators).filter(
    ([name, definition]) => config.validators?.[name as ChangeValidatorName]
          ?? (isCheckOnly ? definition.defaultInValidate : definition.defaultInDeploy)
  )
  const disabledValidators = Object.entries(changeValidators).filter(
    ([name]) => config.validators?.[name as ChangeValidatorName] === false
  )
  return createChangeValidator(
    activeValidators.map(([_name, validator]) => validator.creator(config, isSandbox, client)),
    disabledValidators.map(([_name, validator]) => validator.creator(config, isSandbox, client)),
  )
}
export default createSalesforceChangeValidator
