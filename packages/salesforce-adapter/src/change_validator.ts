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
import {
  buildLazyShallowTypeResolverElementsSource,
  createChangeValidator,
} from '@salto-io/adapter-utils'
import { deployment } from '@salto-io/adapter-components'
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
import dataChangeValidator from './change_validators/data_change'
import cpqValidator from './change_validators/cpq_trigger'
import sbaaApprovalRulesCustomCondition from './change_validators/sbaa_approval_rules_custom_condition'
import recordTypeDeletionValidator from './change_validators/record_type_deletion'
import flowsValidator from './change_validators/flows'
import fullNameChangedValidator from './change_validators/fullname_changed'
import invalidListViewFilterScope from './change_validators/invalid_listview_filterscope'
import caseAssignmentRulesValidator from './change_validators/case_assignmentRules'
import unknownUser from './change_validators/unknown_users'
import animationRuleRecordType from './change_validators/animation_rule_recordtype'
import duplicateRulesSortOrder from './change_validators/duplicate_rules_sort_order'
import lastLayoutRemoval from './change_validators/last_layout_removal'
import currencyIsoCodes from './change_validators/currency_iso_codes'
import accountSettings from './change_validators/account_settings'
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
  flowsValidator: { creator: (config, isSandbox, client) => flowsValidator(config, isSandbox, client),
    ...defaultAlwaysRun },
  fullNameChangedValidator: { creator: () => fullNameChangedValidator, ...defaultAlwaysRun },
  invalidListViewFilterScope: { creator: () => invalidListViewFilterScope, ...defaultAlwaysRun },
  caseAssignmentRulesValidator: { creator: () => caseAssignmentRulesValidator, ...defaultAlwaysRun },
  omitData: { creator: omitDataValidator, defaultInDeploy: false, defaultInValidate: true },
  dataChange: { creator: () => dataChangeValidator, defaultInDeploy: true, defaultInValidate: false },
  unknownUser: { creator: (_config, _isSandbox, client) => unknownUser(client), ...defaultAlwaysRun },
  animationRuleRecordType: { creator: () => animationRuleRecordType, ...defaultAlwaysRun },
  duplicateRulesSortOrder: { creator: () => duplicateRulesSortOrder, ...defaultAlwaysRun },
  currencyIsoCodes: { creator: () => currencyIsoCodes, ...defaultAlwaysRun },
  lastLayoutRemoval: { creator: () => lastLayoutRemoval, ...defaultAlwaysRun },
  accountSettings: { creator: () => accountSettings(), ...defaultAlwaysRun },
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
  const changeValidator = createChangeValidator(
    activeValidators
      .map(([_name, validator]) => validator.creator(config, isSandbox, client))
      .concat(deployment.changeValidators.getDefaultChangeValidators()),
    disabledValidators.map(([_name, validator]) => validator.creator(config, isSandbox, client)),
  )
  // Returns a change validator with elementsSource that lazily resolves types using resolveTypeShallow
  // upon usage. This is relevant to Change Validators that get instances from the elementsSource.
  return async (changes, elementSource) => ((elementSource === undefined)
    ? changeValidator(changes, elementSource)
    : changeValidator(changes, buildLazyShallowTypeResolverElementsSource(elementSource)))
}

export default createSalesforceChangeValidator
