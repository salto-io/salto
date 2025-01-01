/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
export const flowsQuery = `
 query fetchFlows {
  flows {
    ...FlowFields
  }
}

fragment FlowFields on FlowType {
  id
  name
  botAvatarUrl
  botType
  brandId
  status
  sourceLanguage
  enabledLanguages
  dismissedIntents
  publishedChannelIntegrations {
    ...ChannelIntegrationFields
  }
  channelIntegrations {
    ...ChannelIntegrationFields
  }
  assignedChannelIntegrations {
    ...ChannelIntegrationFields
  }
  isArticleRecommendationsEnabled
  helpCenterAutoReplyStatus
  noMatchedIntentAutoReplyStatus
  isRestrictedArticlePreviewEnabled
  persona
  personaEmojisAllowanceMode
  personaEmojisFilterList
  previewFlowId
  smallTalkReplyStatus
  hasBeenPublished
  subflows {
    ...SubflowFields
  }
  freeTextQuery {
    ...FreeTextQueryFields
  }
  helpCenterAutoReplyFeedback {
    ...HelpCenterAutoReplyFeedbackFields
  }
  greeting {
    ...GreetingFields
  }
  fallback {
    ...FallbackFields
  }
  intentAutoReplyStatuses {
    ...IntentAutoReplyStatusFields
  }
}

fragment ChannelIntegrationFields on ChannelIntegrationType {
  id
  status
  type
  displayName
  brandId
  productLine
  brandColor
  conversationColor
  actionColor
  displayStyle
}

fragment SubflowFields on SubflowType {
  id
  flowId
  name
  updatedAt
  editedAt
  status
  isFromLegacyFlow
  campaigns {
    ...ProactiveCampaignFields
  }
  intents {
    ...IntentFields
  }
  trainingPhrases {
    ...TrainingPhraseFields
  }
  nodes {
    ...NodeWithAuxiliaryData
    __typename
  }
}

fragment NodeWithAuxiliaryData on NodeType {
  id
  externalId
  parentId
  targetType
  data
  version
  __typename
}

fragment ProactiveCampaignFields on ProactiveCampaignType {
  campaignId
  name
}

fragment IntentFields on IntentType {
  subflowIntentId
  subflowId
  intentKey
}

fragment TrainingPhraseFields on TrainingPhraseType {
  id
  text
}

fragment FreeTextQueryFields on FreeTextQueryType {
  id
  flowId
  isDisambiguationEnabled
  disambiguationMessageText
  isDisambiguationAiEnhancedMessage
  isClarificationEnabled
  clarificationMessageText
  isClarificationAiEnhancedMessage
}

fragment HelpCenterAutoReplyFeedbackFields on HelpCenterAutoReplyFeedbackType {
  id
  flowId
  messageForPositive
  generateVariantsForPositive
  suggestedAnswersForPositive {
    ...SubflowSummaryFields
  }
  messageForNegative
  generateVariantsForNegative
  suggestedAnswersForNegative {
    ...SubflowSummaryFields
  }
  isTalkToHumanOptionEnabledForPositive
  isTalkToHumanOptionEnabledForNegative
}

fragment SubflowSummaryFields on SubflowType {
  id
  flowId
  name
  updatedAt
  status
  isFromLegacyFlow
}

fragment GreetingFields on GreetingType {
  id
  flowId
  isMessageTextEnabled
  messageText
  isAiEnhancedMessage
  suggestedAnswers {
    ...SubflowSummaryFields
  }
  isTalkToHumanOptionEnabled
}

fragment FallbackFields on FallbackType {
  id
  flowId
  messageText
  isAiEnhancedMessage
  suggestedAnswers {
    ...SubflowSummaryFields
  }
  isTalkToHumanOptionEnabled
}

fragment IntentAutoReplyStatusFields on IntentAutoReplyStatusType {
  id
  flowId
  intentKey
  status
}

`
