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
import { ChangeValidator } from '@salto-io/adapter-api'
import { buildLazyShallowTypeResolverElementsSource } from '@salto-io/adapter-utils'
import _ from 'lodash'
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
import unknownPicklistValues from './change_validators/unknown_picklist_values'
import accountSettings from './change_validators/account_settings'
import installedPackages from './change_validators/installed_packages'
import dataCategoryGroupValidator from './change_validators/data_category_group'
import standardFieldOrObjectAdditionsOrDeletions from './change_validators/standard_field_or_object_additions_or_deletions'
import deletedNonQueryableFields from './change_validators/deleted_non_queryable_fields'
import instanceWithUnknownType from './change_validators/instance_with_unknown_type'
import artificialTypes from './change_validators/artifical_types'
import taskOrEventFieldsModifications from './change_validators/task_or_event_fields_modifications'
import newFieldsAndObjectsFLS from './change_validators/new_fields_and_objects_fls'
import SalesforceClient from './client/client'
import { ChangeValidatorName, DEPLOY_CONFIG, SalesforceConfig } from './types'
import metadataTypes from './change_validators/metadata_types'

const { createChangeValidator, getDefaultChangeValidators } =
  deployment.changeValidators

type ChangeValidatorCreator = (
  config: SalesforceConfig,
  isSandbox: boolean,
  client: SalesforceClient,
) => ChangeValidator

export const defaultChangeValidatorsDeployConfig: Record<string, boolean> = {
  omitData: false,
}
export const defaultChangeValidatorsValidateConfig: Record<string, boolean> = {
  dataChange: false,
}

export const changeValidators: Record<
  ChangeValidatorName,
  ChangeValidatorCreator
> = {
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
  recordTypeDeletion: () => recordTypeDeletionValidator,
  flowsValidator: (config, isSandbox, client) =>
    flowsValidator(config, isSandbox, client),
  fullNameChangedValidator: () => fullNameChangedValidator,
  invalidListViewFilterScope: () => invalidListViewFilterScope,
  caseAssignmentRulesValidator: () => caseAssignmentRulesValidator,
  omitData: () => omitDataValidator,
  dataChange: () => dataChangeValidator,
  unknownUser: (_config, _isSandbox, client) => unknownUser(client),
  animationRuleRecordType: () => animationRuleRecordType,
  duplicateRulesSortOrder: () => duplicateRulesSortOrder,
  currencyIsoCodes: () => currencyIsoCodes,
  lastLayoutRemoval: () => lastLayoutRemoval,
  accountSettings: () => accountSettings,
  unknownPicklistValues: () => unknownPicklistValues,
  installedPackages: () => installedPackages,
  dataCategoryGroup: () => dataCategoryGroupValidator,
  standardFieldOrObjectAdditionsOrDeletions: () =>
    standardFieldOrObjectAdditionsOrDeletions,
  deletedNonQueryableFields: () => deletedNonQueryableFields,
  instanceWithUnknownType: () => instanceWithUnknownType,
  artificialTypes: () => artificialTypes,
  metadataTypes: () => metadataTypes,
  taskOrEventFieldsModifications: () => taskOrEventFieldsModifications,
  newFieldsAndObjectsFLS: (config) => newFieldsAndObjectsFLS(config),
  ..._.mapValues(getDefaultChangeValidators(), (validator) => () => validator),
}

const createSalesforceChangeValidator = ({
  config,
  isSandbox,
  checkOnly,
  client,
}: {
  config: SalesforceConfig
  isSandbox: boolean
  checkOnly: boolean
  client: SalesforceClient
}): ChangeValidator => {
  const isCheckOnly = checkOnly || (config.client?.deploy?.checkOnly ?? false)
  const defaultValidatorsActivationConfig = isCheckOnly
    ? defaultChangeValidatorsValidateConfig
    : defaultChangeValidatorsDeployConfig

  const changeValidator = createChangeValidator({
    validators: _.mapValues(changeValidators, (validator) =>
      validator(config, isSandbox, client),
    ),
    validatorsActivationConfig: {
      ...defaultValidatorsActivationConfig,
      ...config[DEPLOY_CONFIG]?.changeValidators,
    },
  })

  // Returns a change validator with elementsSource that lazily resolves types using resolveTypeShallow
  // upon usage. This is relevant to Change Validators that get instances from the elementsSource.
  return async (changes, elementSource) =>
    elementSource === undefined
      ? changeValidator(changes, elementSource)
      : changeValidator(
          changes,
          buildLazyShallowTypeResolverElementsSource(elementSource),
        )
}

export default createSalesforceChangeValidator
