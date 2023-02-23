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
import { config as configUtils, deployment } from '@salto-io/adapter-components'
import {
  accountSettingsValidator,
  emptyCustomFieldOptionsValidator,
  emptyVariantsValidator,
  duplicateCustomFieldOptionValuesValidator,
  noDuplicateLocaleIdInDynamicContentItemValidator,
  onlyOneTicketFormDefaultValidator,
  missingFromParentValidatorCreator,
  childMissingParentAnnotationValidatorCreator,
  removedFromParentValidatorCreator,
  parentAnnotationToHaveSingleValueValidatorCreator,
  customRoleNameValidator,
  customRoleRemovalValidator,
  invalidActionsValidator,
  orderInstanceContainsAllTheInstancesValidator,
  triggerOrderInstanceContainsAllTheInstancesValidator,
  brandCreationValidator,
  webhookAuthDataValidator,
  targetAuthDataValidator,
  phoneNumbersValidator,
  automationAllConditionsValidator,
  requiredAppOwnedParametersValidator,
  oneTranslationPerLocaleValidator,
  brandFieldForBrandBasedElementsValidator,
  translationForDefaultLocaleValidator,
  articleRemovalValidator,
  articleLabelNamesRemovalValidator,
  articleAttachmentSizeValidator,
  helpCenterActivationValidator,
  helpCenterCreationOrRemovalValidator,
  everyoneUserSegmentModificationValidator,
  guideOrderDeletionValidator,
  childrenReferencesValidator,
  childInOrderValidator,
  orderChildrenParentValidator,
  macroActionsTicketFieldDeactivationValidator,
  sideConversationsValidator,
  externalSourceWebhook,
  usersValidator,
  customStatusUniqueAgentLabelValidator,
  customStatusCategoryChangeValidator,
  customStatusCategoryValidator,
  defaultCustomStatusesValidator,
  customStatusActiveDefaultValidator,
  defaultGroupChangeValidator,
  organizationExistenceValidator,
} from './change_validators'
import ZendeskClient from './client/client'
import { ZedneskDeployConfig, ZendeskFetchConfig } from './config'

const {
  deployTypesNotSupportedValidator,
  createCheckDeploymentBasedOnConfigValidator,
  createSkipParentsOfSkippedInstancesValidator,
  getDefaultChangeValidators,
} = deployment.changeValidators

export default ({
  client,
  apiConfig,
  fetchConfig,
  deployConfig,
  typesDeployedViaParent,
  typesWithNoDeploy,
}: {
  client: ZendeskClient
  apiConfig: configUtils.AdapterDuckTypeApiConfig
  fetchConfig: ZendeskFetchConfig
  deployConfig?: ZedneskDeployConfig
  typesDeployedViaParent: string[]
  typesWithNoDeploy: string[]
}): ChangeValidator => {
  const validators: ChangeValidator[] = [
    ...getDefaultChangeValidators(),
    deployTypesNotSupportedValidator,
    createCheckDeploymentBasedOnConfigValidator(
      { apiConfig, typesDeployedViaParent, typesWithNoDeploy }
    ),
    accountSettingsValidator,
    emptyCustomFieldOptionsValidator,
    emptyVariantsValidator,
    parentAnnotationToHaveSingleValueValidatorCreator(apiConfig),
    missingFromParentValidatorCreator(apiConfig),
    childMissingParentAnnotationValidatorCreator(apiConfig),
    removedFromParentValidatorCreator(apiConfig),
    duplicateCustomFieldOptionValuesValidator,
    noDuplicateLocaleIdInDynamicContentItemValidator,
    onlyOneTicketFormDefaultValidator,
    customRoleNameValidator,
    invalidActionsValidator,
    orderInstanceContainsAllTheInstancesValidator,
    triggerOrderInstanceContainsAllTheInstancesValidator,
    brandCreationValidator(client),
    webhookAuthDataValidator(client),
    targetAuthDataValidator(client, apiConfig),
    phoneNumbersValidator,
    automationAllConditionsValidator,
    macroActionsTicketFieldDeactivationValidator,
    customStatusUniqueAgentLabelValidator,
    customStatusCategoryChangeValidator,
    customStatusCategoryValidator,
    customStatusActiveDefaultValidator,
    defaultCustomStatusesValidator,
    customRoleRemovalValidator(client),
    sideConversationsValidator,
    usersValidator(client, deployConfig),
    requiredAppOwnedParametersValidator,
    oneTranslationPerLocaleValidator,
    articleRemovalValidator,
    articleLabelNamesRemovalValidator,
    articleAttachmentSizeValidator,
    everyoneUserSegmentModificationValidator,
    brandFieldForBrandBasedElementsValidator,
    translationForDefaultLocaleValidator,
    helpCenterActivationValidator,
    helpCenterCreationOrRemovalValidator(client, apiConfig),
    externalSourceWebhook,
    defaultGroupChangeValidator,
    organizationExistenceValidator(client, fetchConfig),
    // *** Guide Order Validators ***
    childInOrderValidator,
    childrenReferencesValidator,
    orderChildrenParentValidator,
    guideOrderDeletionValidator,
    // ******************************
  ]
  return createSkipParentsOfSkippedInstancesValidator(validators)
}
