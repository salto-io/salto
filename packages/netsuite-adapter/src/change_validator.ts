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
import { ChangeError, ChangeValidator } from '@salto-io/adapter-api'
import accountSpecificValuesValidator from './change_validators/account_specific_values'
import dataAccountSpecificValuesValidator from './change_validators/data_account_specific_values'
import removeCustomTypesValidator from './change_validators/remove_custom_types'
import removeFileCabinetValidator from './change_validators/remove_file_cabinet'
import removeListItemValidator from './change_validators/remove_list_item'
import instanceChangesValidator from './change_validators/instance_changes'
import saveSearchMoveEnvironment from './change_validators/saved_search_move_environment'
import fileValidator from './change_validators/file_changes'
import immutableChangesValidator from './change_validators/immutable_changes'
import subInstancesValidator from './change_validators/subinstances'
import customTypesInvalidValuesValidator from './change_validators/custom_types_invalid_values'
import safeDeployValidator, { FetchByQueryFunc } from './change_validators/safe_deploy'
import mappedListsIndexesValidator from './change_validators/mapped_lists_indexes'
import configChangesValidator from './change_validators/config_changes'
import suiteAppConfigElementsValidator from './change_validators/suiteapp_config_elements'
import { validateDependsOnInvalidElement } from './change_validators/dependencies'
import notYetSupportedValuesValidator from './change_validators/not_yet_supported_values'


const changeValidators: ChangeValidator[] = [
  accountSpecificValuesValidator,
  dataAccountSpecificValuesValidator,
  removeCustomTypesValidator,
  instanceChangesValidator,
  saveSearchMoveEnvironment,
  immutableChangesValidator,
  removeListItemValidator,
  fileValidator,
  subInstancesValidator,
  customTypesInvalidValuesValidator,
  mappedListsIndexesValidator,
  notYetSupportedValuesValidator,
  configChangesValidator,
  suiteAppConfigElementsValidator,
]

const nonSuiteAppValidators: ChangeValidator[] = [
  removeFileCabinetValidator,
]

/**
 * This method runs all change validators and then walks recursively on all references of the valid
 * changes to detect changes that depends on invalid ones and then generate errors for them as well
 */


const getChangeValidator: ({ withSuiteApp, warnStaleData, fetchByQuery, deployReferencedElements }
  : {
  withSuiteApp: boolean
  warnStaleData: boolean
  fetchByQuery: FetchByQueryFunc
  deployReferencedElements?: boolean
  }) => ChangeValidator = (
    { withSuiteApp, warnStaleData, fetchByQuery, deployReferencedElements }
  ) =>
    async changes => {
      const validators = withSuiteApp
        ? [...changeValidators]
        : [...changeValidators, ...nonSuiteAppValidators]

      const changeErrors: ChangeError[] = _.flatten(await Promise.all([
        ...validators.map(validator => validator(changes)),
        warnStaleData ? safeDeployValidator(changes, fetchByQuery, deployReferencedElements) : [],
      ]))

      const invalidElementIds = changeErrors
        .filter(error => error.severity === 'Error')
        .map(error => error.elemID.getFullName())
      return changeErrors.concat(await validateDependsOnInvalidElement(invalidElementIds, changes))
    }

export default getChangeValidator
