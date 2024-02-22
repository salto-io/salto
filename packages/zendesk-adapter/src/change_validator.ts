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
  orderDeletionValidator,
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
  guideThemeDeleteLiveValidator,
  guideThemeUpdateMetadataValidator,
  additionOfTicketStatusForTicketFormValidator,
  defaultDynamicContentItemVariantValidator,
  featureActivationValidator,
  activeActionFeaturesValidator,
  standardFieldsValidator,
  uniqueAutomationConditionsValidator,
  defaultAutomationRemovalValidator,
  attachmentWithoutContentValidator,
  duplicateRoutingAttributeValueValidator,
  triggerCategoryRemovalValidator,
  ticketFieldDeactivationValidator,
  duplicateIdFieldValuesValidator,
  notEnabledMissingReferencesValidator,
  conditionalTicketFieldsValidator,
  dynamicContentDeletionValidator,
  guideThemeReadonlyValidator,
  dynamicContentPlaceholderModificationValidator,
  inactiveTicketFormInViewValidator,
  immutableTypeAndKeyForUserFieldsValidator,
  localeModificationValidator,
} from './change_validators'
import ZendeskClient from './client/client'
import { ChangeValidatorName, ZendeskDeployConfig, ZendeskFetchConfig, ZendeskConfig } from './config'

const {
  deployTypesNotSupportedValidator,
  createCheckDeploymentBasedOnConfigValidator,
  createSkipParentsOfSkippedInstancesValidator,
  getDefaultChangeValidators,
} = deployment.changeValidators

export default ({
  client,
  config,
  apiConfig,
  fetchConfig,
  deployConfig,
  typesDeployedViaParent,
  typesWithNoDeploy,
}: {
  client: ZendeskClient
  config: ZendeskConfig
  apiConfig: configUtils.AdapterDuckTypeApiConfig
  fetchConfig: ZendeskFetchConfig
  deployConfig?: ZendeskDeployConfig
  typesDeployedViaParent: string[]
  typesWithNoDeploy: string[]
}): ChangeValidator => {
  const validators: Record<ChangeValidatorName, ChangeValidator> = {
    ...getDefaultChangeValidators(),
    deployTypesNotSupported: deployTypesNotSupportedValidator,
    createCheckDeploymentBasedOnConfig: createCheckDeploymentBasedOnConfigValidator({
      typesConfig: apiConfig.types,
      typesDeployedViaParent,
      typesWithNoDeploy,
    }),
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
    customRoleRemoval: customRoleRemovalValidator(client, fetchConfig),
    sideConversations: sideConversationsValidator,
    users: usersValidator(client, fetchConfig),
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
    defaultGroupChange: defaultGroupChangeValidator(client),
    organizationExistence: organizationExistenceValidator(client, fetchConfig, deployConfig),
    badFormatWebhookAction: badFormatWebhookActionValidator,
    guideDisabled: guideDisabledValidator(fetchConfig),
    guideThemeReadonly: guideThemeReadonlyValidator,
    guideThemeDeleteLive: guideThemeDeleteLiveValidator,
    guideThemeUpdateMetadata: guideThemeUpdateMetadataValidator,
    additionOfTicketStatusForTicketForm: additionOfTicketStatusForTicketFormValidator,
    defaultDynamicContentItemVariant: defaultDynamicContentItemVariantValidator,
    dynamicContentPlaceholderModification: dynamicContentPlaceholderModificationValidator,
    featureActivation: featureActivationValidator,
    deflectionAction: activeActionFeaturesValidator,
    standardFields: standardFieldsValidator,
    uniqueAutomationConditions: uniqueAutomationConditionsValidator,
    defaultAutomationRemoval: defaultAutomationRemovalValidator,
    attachmentWithoutContent: attachmentWithoutContentValidator,
    duplicateRoutingAttributeValue: duplicateRoutingAttributeValueValidator,
    triggerCategoryRemoval: triggerCategoryRemovalValidator(apiConfig, fetchConfig),
    duplicateIdFieldValues: duplicateIdFieldValuesValidator(apiConfig),
    notEnabledMissingReferences: notEnabledMissingReferencesValidator(config),
    conditionalTicketFields: conditionalTicketFieldsValidator,
    dynamicContentDeletion: dynamicContentDeletionValidator,
    inactiveTicketFormInView: inactiveTicketFormInViewValidator,
    immutableTypeAndKeyForUserFields: immutableTypeAndKeyForUserFieldsValidator,
    localeModification: localeModificationValidator,
    // *** Guide Order Validators ***
    childInOrder: childInOrderValidator,
    childrenReferences: childrenReferencesValidator,
    orderChildrenParent: orderChildrenParentValidator,
    guideOrderDeletion: orderDeletionValidator,
    ticketFieldDeactivation: ticketFieldDeactivationValidator,
    // ******************************
  }

  return createSkipParentsOfSkippedInstancesValidator({
    validators,
    validatorsActivationConfig: deployConfig?.changeValidators,
  })
}
