/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ObjectType, ElemID, InstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { ZENDESK, BRAND_TYPE_NAME, CONVERSATION_BOT, BOT_BUILDER_ANSWER, BOT_BUILDER_NODE } from '../../src/constants'
import filterCreator from '../../src/filters/bot_builder_arrange_paths'
import { createFilterCreatorParams } from '../utils'

describe('bot_builder_arrange_paths', () => {
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType

  const brandType = new ObjectType({
    elemID: new ElemID(ZENDESK, BRAND_TYPE_NAME),
  })
  const botBuilderFlowType = new ObjectType({ elemID: new ElemID(ZENDESK, CONVERSATION_BOT) })
  const botBuilderAnswerType = new ObjectType({ elemID: new ElemID(ZENDESK, BOT_BUILDER_ANSWER) })
  const botBuilderNodeType = new ObjectType({ elemID: new ElemID(ZENDESK, BOT_BUILDER_NODE) })

  const brand = new InstanceElement('brandName', brandType, { name: 'brandName' })

  const botBuilderNodeInstance = new InstanceElement('nodeName', botBuilderNodeType, { id: 'nodeId' })
  const botBuilderAnswerInstance = new InstanceElement('answerName', botBuilderAnswerType, {
    name: 'answerName',
    nodes: [new ReferenceExpression(botBuilderNodeInstance.elemID, botBuilderNodeInstance)],
  })
  const botBuilderFlowInstance = new InstanceElement('flowName', botBuilderFlowType, {
    name: 'flowName',
    subflows: [new ReferenceExpression(botBuilderAnswerInstance.elemID, botBuilderAnswerInstance)],
    brandId: new ReferenceExpression(brand.elemID, brand),
  })
  describe('onFetch', () => {
    beforeEach(() => {
      filter = filterCreator(createFilterCreatorParams({})) as FilterType
    })
    it('should create the correct paths', async () => {
      const botBuilderFlowInstanceClone = botBuilderFlowInstance.clone()
      await filter.onFetch([botBuilderFlowInstanceClone, brand])
      const botBuilderAnswerRes = botBuilderFlowInstanceClone.value.subflows[0].value
      const botBuilderNodeRes = botBuilderAnswerRes.value.nodes[0].value
      expect(botBuilderFlowInstanceClone.path).toEqual([
        ZENDESK,
        'Records',
        'bot_builder',
        'brands',
        'brandName',
        'flows',
        'flowName',
        'flowName',
      ])
      expect(botBuilderAnswerRes.path).toEqual([
        ZENDESK,
        'Records',
        'bot_builder',
        'brands',
        'brandName',
        'flows',
        'flowName',
        'answers',
        'answerName',
        'answerName',
      ])
      expect(botBuilderNodeRes.path).toEqual([
        ZENDESK,
        'Records',
        'bot_builder',
        'brands',
        'brandName',
        'flows',
        'flowName',
        'answers',
        'answerName',
        'nodes',
        'nodeId',
      ])
    })

    it('should create unsorted paths if the brand is missing', async () => {
      const botBuilderFlowInstanceClone = botBuilderFlowInstance.clone()
      botBuilderFlowInstanceClone.value.brandId = undefined
      await filter.onFetch([botBuilderFlowInstanceClone])
      const botBuilderAnswerRes = botBuilderFlowInstanceClone.value.subflows[0].value
      const botBuilderNodeRes = botBuilderAnswerRes.value.nodes[0].value
      expect(botBuilderFlowInstanceClone.path).toEqual([
        ZENDESK,
        'Records',
        'bot_builder',
        'unsorted',
        'flows',
        'flowName',
      ])
      expect(botBuilderAnswerRes.path).toEqual([
        ZENDESK,
        'Records',
        'bot_builder',
        'unsorted',
        'flows',
        'answers',
        'answerName',
        'answerName',
      ])
      expect(botBuilderNodeRes.path).toEqual([
        ZENDESK,
        'Records',
        'bot_builder',
        'unsorted',
        'flows',
        'answers',
        'answerName',
        'nodes',
        'nodeId',
      ])
    })
  })
})
