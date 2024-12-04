/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
  targetValidator,
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
  duplicateDynamicContentItemValidator,
  notEnabledMissingReferencesValidator,
  conditionalTicketFieldsValidator,
  dynamicContentDeletionValidator,
  dynamicContentPlaceholderModificationValidator,
  inactiveTicketFormInViewValidator,
  immutableTypeAndKeyForUserFieldsValidator,
  localeModificationValidator,
  emptyAutomationOrderValidator,
  viewCustomStatusConditionsValidator,
  businessHoursScheduleHolidayChangeValidator,
  defaultSupportAddressValidator,
} from './change_validators'
import ZendeskClient from './client/client'
import { ChangeValidatorName, ZendeskConfig } from './config'
import { ZendeskDeployConfig, ZendeskFetchConfig } from './user_config'

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
    targetAuthData: targetValidator(client, apiConfig),
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
    triggerCategoryRemoval: triggerCategoryRemovalValidator(fetchConfig),
    duplicateIdFieldValues: duplicateIdFieldValuesValidator(apiConfig),
    duplicateDynamicContentItem: duplicateDynamicContentItemValidator,
    notEnabledMissingReferences: notEnabledMissingReferencesValidator(config),
    conditionalTicketFields: conditionalTicketFieldsValidator,
    dynamicContentDeletion: dynamicContentDeletionValidator,
    inactiveTicketFormInView: inactiveTicketFormInViewValidator,
    immutableTypeAndKeyForUserFields: immutableTypeAndKeyForUserFieldsValidator,
    localeModification: localeModificationValidator,
    emptyAutomationOrder: emptyAutomationOrderValidator,
    viewCustomStatusConditions: viewCustomStatusConditionsValidator,
    // *** Guide Order Validators ***
    childInOrder: childInOrderValidator,
    childrenReferences: childrenReferencesValidator,
    orderChildrenParent: orderChildrenParentValidator,
    guideOrderDeletion: orderDeletionValidator,
    ticketFieldDeactivation: ticketFieldDeactivationValidator,
    defaultSupportAddress: defaultSupportAddressValidator,
    // ******************************
    businessHoursScheduleHoliday: businessHoursScheduleHolidayChangeValidator,
  }

  return createSkipParentsOfSkippedInstancesValidator({
    validators,
    validatorsActivationConfig: deployConfig?.changeValidators,
  })
}
