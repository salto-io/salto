/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { Change, CORE_ANNOTATIONS, InstanceElement, toChange } from '@salto-io/adapter-api'
import liveChatButtonRoutingType from '../../src/change_validators/live_chat_button_routing_type'
import { createInstanceElement } from '../../src/transformers/transformer'
import { mockTypes } from '../mock_elements'

describe('live chat button routing type change validator', () => {
  let liveChatButton: InstanceElement
  let liveChatButtonChange: Change
  describe('when there are no LiveChatButton instances with routingType Omni-Channel', () => {
    beforeEach(() => {
      liveChatButton = createInstanceElement(
        {
          fullName: 'Test liveChatButton',
          skills: 'skill',
          routingType: 'Choice',
        },
        mockTypes.LiveChatButton,
      )
      liveChatButtonChange = toChange({ after: liveChatButton })
    })
    it('should not return any errors', async () => {
      const errors = await liveChatButtonRoutingType([liveChatButtonChange])
      expect(errors).toBeEmpty()
    })
  })
  describe('when there are LiveChatButton instances with routingType Omni-Channel', () => {
    beforeEach(() => {
      liveChatButton = createInstanceElement(
        {
          fullName: 'Test liveChatButton',
          values: {},
        },
        mockTypes.LiveChatButton,
      )
      liveChatButtonChange = toChange({ after: liveChatButton })
    })
    it('should return warning', async () => {
      const errors = await liveChatButtonRoutingType([liveChatButtonChange])
      const expected = {
        elemID: liveChatButton.elemID,
        severity: 'Warning',
        message: 'Salesforce does not support LiveChatButton with routingType "Omni-Channel"',
        detailedMessage: `Cannot deploy LiveChatButton with routingType set to "Omni-Channel" because Salesforce does not support them: https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_livechatbutton.htm?_ga=2.198568300.2106099414.1736670790-665087354.1736070429#:~:text=Chats%20routed%20with%20Omni%2DChannel%20aren%E2%80%99t%20supported%20in%20the%20Metadata%20API. To proceed with deployment, update the routingType to a value other than "Omni-Channel" before deploying, here:${liveChatButton.annotations[CORE_ANNOTATIONS.SERVICE_URL]}. After deployment, you can change it back to "Omni-Channel" if required.`,
      }
      expect(errors[0]).toEqual(expected)
    })
  })
})
