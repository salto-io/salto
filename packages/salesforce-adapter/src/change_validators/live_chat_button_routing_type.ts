/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import {
  ChangeValidator,
  InstanceElement,
  Element,
  getChangeData,
  ChangeError,
  CORE_ANNOTATIONS,
} from '@salto-io/adapter-api'
import { isInstanceOfTypeSync } from '../filters/utils'
import { LIVE_CHAT_BUTTON } from '../constants'

const isOmniChannelRoutedLiveChatButton = (element: Element): element is InstanceElement => {
  const bool =
    isInstanceOfTypeSync(LIVE_CHAT_BUTTON)(element) &&
    _.isUndefined(_.get(element.value, 'routingType')) &&
    _.isUndefined(_.get(element.value, 'skills'))
  return bool
}

const createChangeError = (instance: InstanceElement): ChangeError => ({
  elemID: instance.elemID,
  severity: 'Warning',
  message: 'Salesforce does not support LiveChatButton with routingType "Omni-Channel"',
  detailedMessage: `Cannot deploy LiveChatButton with routingType set to "Omni-Channel" because [Salesforce does not support them](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_livechatbutton.htm?_ga=2.198568300.2106099414.1736670790-665087354.1736070429#:~:text=Chats%20routed%20with%20Omni%2DChannel%20aren%E2%80%99t%20supported%20in%20the%20Metadata%20API). To proceed with deployment, before deploying change the routingType to a value other than "Omni-Channel", [here](${instance.annotations[CORE_ANNOTATIONS.SERVICE_URL]}). After deployment, you can change it back to "Omni-Channel" if required.`,
})

const changeValidator: ChangeValidator = async changes =>
  changes.map(getChangeData).filter(isOmniChannelRoutedLiveChatButton).map(createChangeError)

export default changeValidator
