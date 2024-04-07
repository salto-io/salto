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
import _ from 'lodash'

import {
  ChangeError,
  getChangeData,
  ChangeValidator,
  Change,
  ChangeDataType,
  isFieldChange,
  isAdditionOrRemovalChange,
  ReadOnlyElementsSource,
} from '@salto-io/adapter-api'
import { deployment } from '@salto-io/adapter-components'
import inactiveParent from './change_validators/inactive_parent'
import accountSpecificValuesValidator from './change_validators/account_specific_values'
import dataAccountSpecificValuesValidator from './change_validators/data_account_specific_values'
import removeStandardTypesValidator from './change_validators/remove_standard_types'
import removeFileCabinetValidator from './change_validators/remove_file_cabinet'
import removeListItemValidator from './change_validators/remove_list_item'
import removeListItemWithoutScriptIDValidator from './change_validators/remove_list_item_without_scriptid'
import instanceChangesValidator from './change_validators/instance_changes'
import removeSdfElementsValidator from './change_validators/remove_sdf_elements'
import reportTypesMoveEnvironment from './change_validators/report_types_move_environment'
import fileValidator from './change_validators/file_changes'
import immutableChangesValidator from './change_validators/immutable_changes'
import uniqueFieldsValidator from './change_validators/unique_fields'
import subInstancesValidator from './change_validators/subinstances'
import standardTypesInvalidValuesValidator from './change_validators/standard_types_invalid_values'
import safeDeployValidator from './change_validators/safe_deploy'
import mappedListsIndexesValidator from './change_validators/mapped_lists_indexes'
import configChangesValidator from './change_validators/config_changes'
import suiteAppConfigElementsValidator from './change_validators/suiteapp_config_elements'
import undeployableConfigFeaturesValidator from './change_validators/undeployable_config_features'
import extraReferenceDependenciesValidator from './change_validators/extra_reference_dependencies'
import { validateDependsOnInvalidElement } from './change_validators/dependencies'
import notYetSupportedValuesValidator from './change_validators/not_yet_supported_values'
import workflowAccountSpecificValuesValidator from './change_validators/workflow_account_specific_values'
import exchangeRateValidator from './change_validators/currency_exchange_rate'
import netsuiteClientValidation from './change_validators/client_validation'
import currencyUndeployableFieldsValidator from './change_validators/currency_undeployable_fields'
import fileCabinetInternalIdsValidator from './change_validators/file_cabinet_internal_ids'
import rolePermissionValidator from './change_validators/role_permission_ids'
import translationCollectionValidator from './change_validators/translation_collection_references'
import omitFieldsValidator from './change_validators/omit_fields'
import unreferencedFileAdditionValidator from './change_validators/unreferenced_file_addition'
import unreferencedDatasetsValidator from './change_validators/check_referenced_datasets'
import analyticsSilentFailureValidator from './change_validators/analytics_post_deploy_notification'
import bundleChangesValidator from './change_validators/bundle_changes'
import customRecordEmptyPermissionListValidator from './change_validators/custom_record_empty_permission_list'
import NetsuiteClient from './client/client'
import {
  AdditionalDependencies,
  NetsuiteConfig,
  NetsuiteValidatorName,
  NonSuiteAppValidatorName,
  OnlySuiteAppValidatorName,
} from './config/types'
import { Filter } from './filter'
import { NetsuiteChangeValidator } from './change_validators/types'
import { FetchByQueryFunc } from './config/query'

const { createChangeValidator } = deployment.changeValidators

const defaultChangeValidators = deployment.changeValidators.getDefaultChangeValidators()

const netsuiteChangeValidators: Record<NetsuiteValidatorName, NetsuiteChangeValidator> = {
  exchangeRate: exchangeRateValidator,
  currencyUndeployableFields: currencyUndeployableFieldsValidator,
  workflowAccountSpecificValues: workflowAccountSpecificValuesValidator,
  accountSpecificValues: accountSpecificValuesValidator,
  dataAccountSpecificValues: dataAccountSpecificValuesValidator,
  removeSdfElements: removeSdfElementsValidator,
  instanceChanges: instanceChangesValidator,
  reportTypesMove: reportTypesMoveEnvironment,
  immutableChanges: immutableChangesValidator,
  inactive: inactiveParent,
  removeListItem: removeListItemValidator,
  removeListItemWithoutScriptID: removeListItemWithoutScriptIDValidator,
  file: fileValidator,
  uniqueFields: uniqueFieldsValidator,
  subInstances: subInstancesValidator,
  standardTypesInvalidValues: standardTypesInvalidValuesValidator,
  mappedListsIndexes: mappedListsIndexesValidator,
  notYetSupportedValues: notYetSupportedValuesValidator,
  configChanges: configChangesValidator,
  suiteAppConfigElements: suiteAppConfigElementsValidator,
  undeployableConfigFeatures: undeployableConfigFeaturesValidator,
  extraReferenceDependencies: extraReferenceDependenciesValidator,
  rolePermission: rolePermissionValidator,
  translationCollectionReferences: translationCollectionValidator,
  omitFields: omitFieldsValidator,
  unreferencedFileAddition: unreferencedFileAdditionValidator,
  unreferencedDatasets: unreferencedDatasetsValidator,
  analyticsSilentFailure: analyticsSilentFailureValidator,
  undeployableBundleChanges: bundleChangesValidator,
  customRecordEmptyPermissionList: customRecordEmptyPermissionListValidator,
}

const nonSuiteAppValidators: Record<NonSuiteAppValidatorName, NetsuiteChangeValidator> = {
  removeFileCabinet: removeFileCabinetValidator,
  removeStandardTypes: removeStandardTypesValidator,
}

const onlySuiteAppValidators: Record<OnlySuiteAppValidatorName, NetsuiteChangeValidator> = {
  fileCabinetInternalIds: fileCabinetInternalIdsValidator,
}

const changeErrorsToElementIDs = (changeErrors: readonly ChangeError[]): readonly string[] =>
  changeErrors
    .filter(error => error.severity === 'Error')
    .map(error => error.elemID.createBaseID().parent.getFullName())

// Filtering fields changes in case the parent element has a change error
// TODO: SALTO-3544 in case of a modification change, we should create a new change with the parent 'before' state
// and the fields currently the process will fail with an exception
const getInvalidFieldChangeIds = (
  changes: readonly Change<ChangeDataType>[],
  invalidElementIds: Set<string>,
): string[] => {
  const invalidRemovalOrAdditionElemIds = new Set(
    changes
      .filter(isAdditionOrRemovalChange)
      .map(change => getChangeData(change).elemID.getFullName())
      .filter(name => invalidElementIds.has(name)),
  )

  return changes
    .filter(isFieldChange)
    .map(getChangeData)
    .filter(elem => invalidRemovalOrAdditionElemIds.has(elem.parent.elemID.getFullName()))
    .map(elem => elem.elemID.getFullName())
}

/**
 * This method runs all change validators and then walks recursively on all references of the valid
 * changes to detect changes that depends on invalid ones and then generate errors for them as well
 */

const getChangeValidator: ({
  client,
  withSuiteApp,
  warnStaleData,
  validate,
  fetchByQuery,
  deployReferencedElements,
  additionalDependencies,
  filtersRunner,
}: {
  client: NetsuiteClient
  withSuiteApp: boolean
  warnStaleData: boolean
  validate: boolean
  fetchByQuery: FetchByQueryFunc
  deployReferencedElements: boolean
  additionalDependencies: AdditionalDependencies
  filtersRunner: (groupID: string) => Required<Filter>
  elementsSource: ReadOnlyElementsSource
  userConfig: NetsuiteConfig
}) => ChangeValidator =
  ({
    client,
    withSuiteApp,
    warnStaleData,
    validate,
    fetchByQuery,
    deployReferencedElements,
    additionalDependencies,
    filtersRunner,
    elementsSource,
    userConfig,
  }) =>
  async (changes, elementSource) => {
    const netsuiteValidators = withSuiteApp
      ? { ...netsuiteChangeValidators, ...onlySuiteAppValidators }
      : { ...netsuiteChangeValidators, ...nonSuiteAppValidators }

    // Converts NetsuiteChangeValidator to ChangeValidator
    const validators: Record<string, ChangeValidator> = _.mapValues(
      netsuiteValidators,
      validator => (innerChanges: ReadonlyArray<Change>) =>
        validator(innerChanges, deployReferencedElements, elementsSource, userConfig, client),
    )
    const safeDeploy = warnStaleData
      ? {
          safeDeploy: (innerChanges: ReadonlyArray<Change>) =>
            safeDeployValidator(innerChanges, fetchByQuery, deployReferencedElements),
        }
      : undefined

    const mergedValidator = createChangeValidator({
      validators: { ...defaultChangeValidators, ...validators, ...safeDeploy },
      validatorsActivationConfig: userConfig.deploy?.changeValidators,
    })
    const validatorChangeErrors = await mergedValidator(changes, elementSource)

    const dependedChangeErrors = await validateDependsOnInvalidElement(
      changeErrorsToElementIDs(validatorChangeErrors),
      changes,
    )
    const changeErrors = validatorChangeErrors.concat(dependedChangeErrors)

    // filter out invalid changes to run netsuiteClientValidation only on relevant changes
    const invalidChangeErrorIds = new Set(changeErrorsToElementIDs(changeErrors))
    const invalidFieldChangeIds = getInvalidFieldChangeIds(changes, invalidChangeErrorIds)
    const invalidElementIds = new Set([...invalidChangeErrorIds, ...invalidFieldChangeIds])
    const validChanges = changes.filter(change => !invalidElementIds.has(getChangeData(change).elemID.getFullName()))

    const netsuiteValidatorErrors = validate
      ? await netsuiteClientValidation(validChanges, client, additionalDependencies, filtersRunner)
      : []

    return changeErrors.concat(netsuiteValidatorErrors)
  }

export default getChangeValidator
