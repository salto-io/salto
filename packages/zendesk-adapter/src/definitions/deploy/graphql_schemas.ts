/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { basicFlowFields, flowFields, nodeFragment, subflowFields } from '../shared/graphql_schemas'

// generativeAiEnabled is always false for now,
// the Flow creation is partial, this should change with SALTO-7257
export const createFlowMutation = `
  mutation createFlow(
    $name: String!,
    $brandId: String!,
    $sourceLanguage: LanguageEnum,
    $botAvatarUrl: String,
    $tone: PersonaToneOfVoiceEnum
  ) {
    createFlow(
      botName: $name,
      brandId: $brandId,
      sourceLanguage: $sourceLanguage,
      botAvatarPath: $botAvatarUrl,
      generativeAiEnabled: false,
      tone: $tone
    ) {
      ...FlowFields
    }
  }

  fragment FlowFields on FlowType {
    ${basicFlowFields}
  }
`

export const updateFlowName = `
  mutation updateFlowName($name: String!, $id: String!) {
    updateFlowName(name: $name, flowId: $id) {
      id
      name
      __typename
    }
  }
`

export const updateFlowLanguages = `
  mutation updateLanguageSettings(
    $id: String!,
    $sourceLanguage: LanguageEnum!,
    $enabledLanguages: [LanguageEnum!]!
  ) {
    updateLanguageSettings(
      flowId: $id
      sourceLanguage: $sourceLanguage
      enabledLanguages: $enabledLanguages
    ) {
      id
      sourceLanguage
      enabledLanguages
    }
  }
`

export const deleteFlowMutation = `
  mutation deleteBotFlow($id: String!) {
    deleteBotFlow(flowId: $id) {
      ...FlowFields
    }
  }

  ${flowFields}
`

// The fields trainingPhrases and intentKeys are not used in the mutation, but are required by the schema
// This is because of a problem with allowEmptyArrays, this should change with SALTO-6584
export const createSubFlowMutation = `
  mutation createSubflow($flowId: String!, $name: String!, $removeIntentsFromOtherSubflows: Boolean) {
    createSubflow(
      flowId: $flowId
      name: $name
      trainingPhrases: []
      intentKeys: []
      removeIntentsFromOtherSubflows: $removeIntentsFromOtherSubflows
    ) {
      ...SubflowFields
    }
  }

  ${subflowFields}
`

export const updateSubFlowMutation = `
  mutation updateSubflow(
    $id: String!
    $name: String!
    $trainingPhrases: [TrainingPhraseInputType!]
    $intentKeys: [String!]
    $removeIntentsFromOtherSubflows: Boolean
  ) {
    updateSubflow(
      subflowId: $id
      name: $name
      trainingPhrases: $trainingPhrases
      intentKeys: $intentKeys
      removeIntentsFromOtherSubflows: $removeIntentsFromOtherSubflows
    ) {
      ...SubflowFields
    }
  }

  ${subflowFields}
`

export const deleteSubFlowMutation = `
  mutation deleteSubflow($id: String!) {
    deleteSubflow(id: $id)
  }
`

export const nodeMutation = `
  mutation applyNodeListTransactionByFlowId($transactionId: String!, $flowId: String!, $subFlowId: String!, $events: [ChangeEvent!]!) {
    applyNodeListTransactionByFlowId(
      transactionId: $transactionId
      flowId: $flowId
      subflowId: $subFlowId
      events: $events
    ) {
      ...NodeWithAuxiliaryData
    }
  }

  ${nodeFragment}
`
