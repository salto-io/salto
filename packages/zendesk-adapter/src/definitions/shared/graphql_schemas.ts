/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
export const nodeFragment = `
fragment NodeWithAuxiliaryData on NodeType {
  id
  externalId
  parentId
  targetType
  data
  version
}
`

export const subflowFields = `
fragment SubflowFields on SubflowType {
  id
  flowId
  name
  updated_at: updatedAt
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
  }
}

${nodeFragment}

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
`

export const basicFlowFields = `
  id
  name
  botAvatarUrl
  botType
  brandId
  status
  sourceLanguage
  enabledLanguages
  dismissedIntents
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
`

export const flowFields = `
fragment FlowFields on FlowType {
  ${basicFlowFields}
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

${subflowFields}

fragment FreeTextQueryFields on FreeTextQueryType {
  id
  isDisambiguationEnabled
  disambiguationMessageText
  isDisambiguationAiEnhancedMessage
  isClarificationEnabled
  clarificationMessageText
  isClarificationAiEnhancedMessage
}

fragment HelpCenterAutoReplyFeedbackFields on HelpCenterAutoReplyFeedbackType {
  id
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
  name
  status
  isFromLegacyFlow
}

fragment GreetingFields on GreetingType {
  id
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
  messageText
  isAiEnhancedMessage
  suggestedAnswers {
    ...SubflowSummaryFields
  }
  isTalkToHumanOptionEnabled
}

fragment IntentAutoReplyStatusFields on IntentAutoReplyStatusType {
  id
  intentKey
  status
}
`
