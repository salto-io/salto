/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ChangeValidator } from '@salto-io/adapter-api'
import { buildLazyShallowTypeResolverElementsSource, GetLookupNameFunc } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { deployment } from '@salto-io/adapter-components'
import packageValidator from './change_validators/package'
import picklistStandardFieldValidator from './change_validators/picklist_standard_field'
import customObjectInstancesValidator from './change_validators/custom_object_instances'
import customFieldTypeValidator from './change_validators/custom_field_type'
import standardFieldLabelValidator from './change_validators/standard_field_label'
import mapKeysValidator from './change_validators/map_keys'
import defaultRulesValidator from './change_validators/default_rules'
import packageVersionValidator from './change_validators/package_version'
import picklistPromoteValidator from './change_validators/picklist_promote'
import omitDataValidator from './change_validators/omit_data'
import dataChangeValidator from './change_validators/data_change'
import cpqValidator from './change_validators/cpq_trigger'
import recordTypeDeletionValidator from './change_validators/record_type_deletion'
import flowsValidator from './change_validators/flows'
import fullNameChangedValidator from './change_validators/full_name_changed'
import invalidListViewFilterScope from './change_validators/invalid_list_view_filter_scope'
import caseAssignmentRulesValidator from './change_validators/case_assignmentRules'
import unknownUser from './change_validators/unknown_users'
import animationRuleRecordType from './change_validators/animation_rule_record_type'
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
import artificialTypes from './change_validators/artificial_types'
import taskOrEventFieldsModifications from './change_validators/task_or_event_fields_modifications'
import newFieldsAndObjectsFLS from './change_validators/new_fields_and_objects_fls'
import metadataTypes from './change_validators/metadata_types'
import elementApiVersionValidator from './change_validators/element_api_version'
import cpqBillingStartDate from './change_validators/cpq_billing_start_date'
import cpqBillingTriggers from './change_validators/cpq_billing_triggers'
import managedApexComponent from './change_validators/managed_apex_component'
import orderedMaps from './change_validators/ordered_maps'
import SalesforceClient from './client/client'
import { ChangeValidatorName, DEPLOY_CONFIG, FetchProfile, SalesforceConfig } from './types'
import { buildFetchProfile } from './fetch_profile/fetch_profile'
import { getLookUpName } from './transformers/reference_mapping'
import layoutDuplicateFields from './change_validators/layout_duplicate_fields'
import customApplications from './change_validators/custom_applications'
import flowReferencedElements from './change_validators/flow_referenced_elements'
import liveChatButtonRoutingType from './change_validators/live_chat_button_routing_type'
import flexiPageUnusedOrMissingFacets from './change_validators/flexi_page_unused_or_missing_facets'
import uniqueFlowElementName from './change_validators/unique_flow_element_name'

const { createChangeValidator, getDefaultChangeValidators } = deployment.changeValidators

type ChangeValidatorCreator = (params: {
  config: SalesforceConfig
  isSandbox: boolean
  client: SalesforceClient
  fetchProfile: FetchProfile
  getLookupNameFunc: GetLookupNameFunc
}) => ChangeValidator

export const defaultChangeValidatorsDeployConfig: Record<string, boolean> = {
  omitData: false,
}
export const defaultChangeValidatorsValidateConfig: Record<string, boolean> = {
  dataChange: false,
}

export const changeValidators: Record<ChangeValidatorName, ChangeValidatorCreator> = {
  managedPackage: () => packageValidator,
  picklistStandardField: () => picklistStandardFieldValidator,
  customObjectInstances: ({ getLookupNameFunc }) => customObjectInstancesValidator(getLookupNameFunc),
  customFieldType: () => customFieldTypeValidator,
  standardFieldLabel: () => standardFieldLabelValidator,
  mapKeys: ({ getLookupNameFunc, fetchProfile }) => mapKeysValidator(getLookupNameFunc, fetchProfile),
  defaultRules: () => defaultRulesValidator,
  packageVersion: () => packageVersionValidator,
  picklistPromote: () => picklistPromoteValidator,
  cpqValidator: () => cpqValidator,
  recordTypeDeletion: () => recordTypeDeletionValidator,
  flowsValidator: ({ fetchProfile, isSandbox, client }) => flowsValidator(fetchProfile, isSandbox, client),
  fullNameChangedValidator: () => fullNameChangedValidator,
  invalidListViewFilterScope: () => invalidListViewFilterScope,
  caseAssignmentRulesValidator: () => caseAssignmentRulesValidator,
  omitData: () => omitDataValidator,
  dataChange: () => dataChangeValidator,
  unknownUser: ({ client }) => unknownUser(client),
  animationRuleRecordType: () => animationRuleRecordType,
  duplicateRulesSortOrder: () => duplicateRulesSortOrder,
  currencyIsoCodes: () => currencyIsoCodes,
  lastLayoutRemoval: () => lastLayoutRemoval,
  accountSettings: () => accountSettings,
  unknownPicklistValues: () => unknownPicklistValues,
  installedPackages: () => installedPackages,
  dataCategoryGroup: () => dataCategoryGroupValidator,
  standardFieldOrObjectAdditionsOrDeletions: () => standardFieldOrObjectAdditionsOrDeletions,
  deletedNonQueryableFields: () => deletedNonQueryableFields,
  instanceWithUnknownType: () => instanceWithUnknownType,
  artificialTypes: () => artificialTypes,
  metadataTypes: () => metadataTypes,
  taskOrEventFieldsModifications: () => taskOrEventFieldsModifications,
  newFieldsAndObjectsFLS: ({ config }) => newFieldsAndObjectsFLS(config),
  elementApiVersion: () => elementApiVersionValidator,
  cpqBillingStartDate: () => cpqBillingStartDate,
  cpqBillingTriggers: () => cpqBillingTriggers,
  managedApexComponent: () => managedApexComponent,
  orderedMaps: ({ fetchProfile }) => orderedMaps(fetchProfile),
  layoutDuplicateFields: () => layoutDuplicateFields,
  customApplications: () => customApplications,
  flowReferencedElements: () => flowReferencedElements,
  liveChatButtonRoutingType: () => liveChatButtonRoutingType,
  flexiPageUnusedOrMissingFacets: () => flexiPageUnusedOrMissingFacets,
  uniqueFlowElementName: () => uniqueFlowElementName,
  ..._.mapValues(getDefaultChangeValidators(), validator => () => validator),
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

  const fetchProfile = buildFetchProfile({ fetchParams: config.fetch ?? {} })
  const getLookupNameFunc: GetLookupNameFunc = getLookUpName(fetchProfile)
  const changeValidator = createChangeValidator({
    validators: _.mapValues(changeValidators, validator =>
      validator({ config, isSandbox, client, fetchProfile, getLookupNameFunc }),
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
      : changeValidator(changes, buildLazyShallowTypeResolverElementsSource(elementSource))
}

export default createSalesforceChangeValidator
