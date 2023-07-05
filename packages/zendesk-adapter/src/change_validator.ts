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
  externalSourceWebhookValidator,
  usersValidator,
  customStatusUniqueAgentLabelValidator,
  customStatusCategoryChangeValidator,
  customStatusCategoryValidator,
  customStatusesEnabledValidator,
  defaultCustomStatusesValidator,
  customStatusActiveDefaultValidator,
  defaultGroupChangeValidator,
  organizationExistenceValidator,
  badFormatWebhookActionValidator,
  guideDisabledValidator,
  additionOfTicketStatusForTicketFormValidator,
  defaultDynamicContentItemVariantValidator,
  featureActivationValidator,
  deflectionActionValidator,
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
  const validators: Record<string, ChangeValidator> = {
    ...getDefaultChangeValidators(),
    deployTypesNotSupported: deployTypesNotSupportedValidator,
    createCheckDeploymentBasedOnConfig: createCheckDeploymentBasedOnConfigValidator(
      { typesConfig: apiConfig.types, typesDeployedViaParent, typesWithNoDeploy }
    ),
    accountSettings: accountSettingsValidator,
    emptyCustomFieldOptions: emptyCustomFieldOptionsValidator,
    emptyVariants: emptyVariantsValidator,
    parentAnnotationToHaveSingleValue: parentAnnotationToHaveSingleValueValidatorCreator(apiConfig),
    missingFromParent: missingFromParentValidatorCreator(apiConfig),
    childMissingParentAnnotation: childMissingParentAnnotationValidatorCreator(apiConfig),
    removedFromParent: removedFromParentValidatorCreator(apiConfig),
    duplicateCustomFieldOptionValues: duplicateCustomFieldOptionValuesValidator,
    noDuplicateLocaleIdInDynamicContentItem: noDuplicateLocaleIdInDynamicContentItemValidator,
    onlyOneTicketFormDefault: onlyOneTicketFormDefaultValidator,
    customRoleName: customRoleNameValidator,
    orderInstanceContainsAllTheInstances: orderInstanceContainsAllTheInstancesValidator,
    triggerOrderInstanceContainsAllTheInstances: triggerOrderInstanceContainsAllTheInstancesValidator,
    brandCreation: brandCreationValidator(client),
    webhookAuthData: webhookAuthDataValidator(client),
    targetAuthData: targetAuthDataValidator(client, apiConfig),
    phoneNumbers: phoneNumbersValidator,
    automationAllConditions: automationAllConditionsValidator,
    macroActionsTicketFieldDeactivation: macroActionsTicketFieldDeactivationValidator,
    customStatusesEnabled: customStatusesEnabledValidator,
    customStatusUniqueAgentLabel: customStatusUniqueAgentLabelValidator,
    customStatusCategoryChange: customStatusCategoryChangeValidator,
    customStatusCategory: customStatusCategoryValidator,
    customStatusActiveDefault: customStatusActiveDefaultValidator,
    defaultCustomStatuses: defaultCustomStatusesValidator,
    customRoleRemoval: customRoleRemovalValidator(client),
    sideConversations: sideConversationsValidator,
    users: usersValidator(client, deployConfig),
    requiredAppOwnedParameters: requiredAppOwnedParametersValidator,
    oneTranslationPerLocale: oneTranslationPerLocaleValidator,
    articleRemoval: articleRemovalValidator,
    articleLabelNamesRemoval: articleLabelNamesRemovalValidator,
    articleAttachmentSize: articleAttachmentSizeValidator,
    everyoneUserSegmentModification: everyoneUserSegmentModificationValidator,
    brandFieldForBrandBasedElements: brandFieldForBrandBasedElementsValidator,
    translationForDefaultLocale: translationForDefaultLocaleValidator,
    helpCenterActivation: helpCenterActivationValidator,
    helpCenterCreationOrRemoval: helpCenterCreationOrRemovalValidator(client, apiConfig),
    externalSourceWebhook: externalSourceWebhookValidator,
    defaultGroupChange: defaultGroupChangeValidator,
    organizationExistence: organizationExistenceValidator(client, fetchConfig),
    badFormatWebhookAction: badFormatWebhookActionValidator,
    guideDisabled: guideDisabledValidator(fetchConfig),
    additionOfTicketStatusForTicketForm: additionOfTicketStatusForTicketFormValidator,
    defaultDynamicContentItemVariant: defaultDynamicContentItemVariantValidator,
    featureActivation: featureActivationValidator,
    deflectionAction: deflectionActionValidator,
    // *** Guide Order Validators ***
    childInOrder: childInOrderValidator,
    childrenReferences: childrenReferencesValidator,
    orderChildrenParent: orderChildrenParentValidator,
    guideOrderDeletion: guideOrderDeletionValidator,
    // ******************************
  }

  return createSkipParentsOfSkippedInstancesValidator({
    validators,
    validatorsActivationConfig: deployConfig?.changeValidators,
  })
}
