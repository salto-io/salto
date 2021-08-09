/*
*                      Copyright 2021 Salto Labs Ltd.
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
import safeDeployValidator, { FetchByQueryFunc } from './change_validators/safe_deploy'
import { validateDependsOnInvalidElement } from './change_validators/dependencies'
import NetsuiteClient from './client/client'


const changeValidators = [
  accountSpecificValuesValidator,
  dataAccountSpecificValuesValidator,
  removeCustomTypesValidator,
  instanceChangesValidator,
  saveSearchMoveEnvironment,
  immutableChangesValidator,
  removeListItemValidator,
  fileValidator,
  subInstancesValidator,
]

const nonSuiteAppValidators: ChangeValidator[] = [
  removeFileCabinetValidator,
]

/**
 * This method runs all change validators and then walks recursively on all references of the valid
 * changes to detect changes that depends on invalid ones and then generate errors for them as well
 */
const getChangeValidator: (client: NetsuiteClient, warnStaleData: boolean,
  fetchByQuery?: FetchByQueryFunc) =>
  ChangeValidator = (client, warnStaleData, fetchByQuery) =>
    async changes => {
      const validators = warnStaleData
        ? [...changeValidators, safeDeployValidator]
        : changeValidators
      if (!client.isSuiteAppConfigured()) validators.push(...nonSuiteAppValidators)

      const changeErrors = _.flatten(await Promise.all(validators
        .map(validator => validator(changes, fetchByQuery))))

      const invalidElementIds = changeErrors.map(error => error.elemID.getFullName())
      return changeErrors.concat(await validateDependsOnInvalidElement(invalidElementIds, changes))
    }

export default getChangeValidator
