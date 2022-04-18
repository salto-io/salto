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
import { config as configUtils, deployment } from '@salto-io/adapter-components'
import {
  accountSettingsValidator,
  emptyCustomFieldOptionsValidator,
  emptyVariantsValidator,
  duplicateCustomFieldOptionValuesValidator,
  noDuplicateLocaleIdInDynamicContentItemValidator,
  onlyOneTicketFormDefaultValidator,
  missingFromParentValidatorCreator,
  removedFromParentValidatorCreator,
  parentAnnotationToHaveSingleValueValidatorCreator,
  customRoleNameValidator,
  invalidActionsValidator,
  orderInstanceContainsAllTheInstancesValidator,
  triggerOrderInstanceContainsAllTheInstancesValidator,
  brandCreationValidator,
} from './change_validators'

const {
  deployTypesNotSupportedValidator,
  createCheckDeploymentBasedOnConfigValidator,
  createSkipParentsOfSkippedInstancesValidator,
} = deployment.changeValidators

export default ({
  apiConfig,
  typesDeployedViaParent,
  typesWithNoDeploy,
}: {
  apiConfig: configUtils.AdapterDuckTypeApiConfig
  typesDeployedViaParent: string[]
  typesWithNoDeploy: string[]
}): ChangeValidator => {
  const validators: ChangeValidator[] = [
    deployTypesNotSupportedValidator,
    createCheckDeploymentBasedOnConfigValidator(
      { apiConfig, typesDeployedViaParent, typesWithNoDeploy }
    ),
    accountSettingsValidator,
    emptyCustomFieldOptionsValidator,
    emptyVariantsValidator,
    parentAnnotationToHaveSingleValueValidatorCreator(apiConfig),
    missingFromParentValidatorCreator(apiConfig),
    removedFromParentValidatorCreator(apiConfig),
    duplicateCustomFieldOptionValuesValidator,
    noDuplicateLocaleIdInDynamicContentItemValidator,
    onlyOneTicketFormDefaultValidator,
    customRoleNameValidator,
    invalidActionsValidator,
    orderInstanceContainsAllTheInstancesValidator,
    triggerOrderInstanceContainsAllTheInstancesValidator,
    brandCreationValidator,
  ]
  return createSkipParentsOfSkippedInstancesValidator(validators)
}
