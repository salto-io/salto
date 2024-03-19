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
import { deployment } from '@salto-io/adapter-components'
import {
  ChangeValidatorName,
  ChangeValidatorsDeploySupportedName,
  DEPLOY_CONFIG,
  ENABLE_DEPLOY_SUPPORT_FLAG,
  WorkatoConfig,
} from './config'
import { typesNotSupportedValidator } from './change_validators/types_not_supported'
import { removalNotSupportedValidator } from './change_validators/removal_not_supported'
import { recipeSettingsNotSupportedValidator } from './change_validators/recipe_settings_not_suuported'

const {
  deployTypesNotSupportedValidator,
  getDefaultChangeValidators,
  createChangeValidator,
  deployNotSupportedValidator,
} = deployment.changeValidators

const validatorsWithDeploy: Record<ChangeValidatorsDeploySupportedName, ChangeValidator> = {
  ...getDefaultChangeValidators(),
  deployTypesNotSupported: deployTypesNotSupportedValidator,
  notSupportedTypes: typesNotSupportedValidator,
  notSupportedRemoval: removalNotSupportedValidator,
  notSupportedRecipeSettings: recipeSettingsNotSupportedValidator,
}

const validatorsWithoutDeploy: Record<
  Exclude<ChangeValidatorName, ChangeValidatorsDeploySupportedName>,
  ChangeValidator
> = {
  ...getDefaultChangeValidators(),
  deployNotSupported: deployNotSupportedValidator,
}

export default (config: WorkatoConfig): ChangeValidator => {
  const validators: Record<string, ChangeValidator> =
    config[ENABLE_DEPLOY_SUPPORT_FLAG] === true ? validatorsWithDeploy : validatorsWithoutDeploy
  return createChangeValidator({
    validators,
    validatorsActivationConfig: config[DEPLOY_CONFIG]?.changeValidators,
  })
}
