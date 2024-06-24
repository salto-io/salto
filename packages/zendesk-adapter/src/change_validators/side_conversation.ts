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
import _ from 'lodash'
import {
  ChangeValidator,
  ElemID,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceChange,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { ACCOUNT_FEATURES_TYPE_NAME, MACRO_TYPE_NAME, TRIGGER_TYPE_NAME, ZENDESK } from '../constants'
import { ActionsType, isAction } from './utils'

const log = logger(module)

// Map side conversation field name in instances to side conversation feature name in the account feature instance
const SIDE_CONVERSATION_MAP: Record<string, string> = {
  side_conversation: 'side_conversations_email',
  side_conversation_slack: 'side_conversations_slack',
  side_conversation_ticket: 'side_conversations_tickets',
}

export const TYPES_WITH_SIDE_CONVERSATIONS = [MACRO_TYPE_NAME, TRIGGER_TYPE_NAME]

const getSideConversationFields = (instance: InstanceElement): string[] =>
  (instance.value.actions ?? [])
    .filter(isAction)
    .filter(
      (action: ActionsType) => _.isString(action.field) && Object.keys(SIDE_CONVERSATION_MAP).includes(action.field),
    )
    .map((action: ActionsType) => action.field)

/**
 * Verify side_conversation features are enabled before deployment of an instance with side_conversation fields
 */
export const sideConversationsValidator: ChangeValidator = async (changes, elementSource) => {
  if (elementSource === undefined) {
    log.error('Failed to run sideConversationsValidator because no element source was provided')
    return []
  }

  const relevantInstances = changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(instance => TYPES_WITH_SIDE_CONVERSATIONS.includes(instance.elemID.typeName))
    .filter(instance => !_.isEmpty(getSideConversationFields(instance)))
  if (_.isEmpty(relevantInstances)) {
    return []
  }

  const featureInstance = await elementSource.get(
    new ElemID(ZENDESK, ACCOUNT_FEATURES_TYPE_NAME, 'instance', ElemID.CONFIG_NAME),
  )
  if (!isInstanceElement(featureInstance)) {
    log.error(`Failed to run sideConversationsValidator because ${ACCOUNT_FEATURES_TYPE_NAME} instance was not found`)
    return []
  }
  const accountDisabledSCFields = Object.keys(SIDE_CONVERSATION_MAP).filter(
    fieldOption => featureInstance.value[SIDE_CONVERSATION_MAP[fieldOption]]?.enabled !== true,
  )

  return relevantInstances.flatMap(instance => {
    const instancesDisabledSCFields = _.uniq(getSideConversationFields(instance)).filter(fieldName =>
      accountDisabledSCFields.includes(fieldName),
    )
    if (_.isEmpty(instancesDisabledSCFields)) {
      return []
    }
    return [
      {
        elemID: instance.elemID,
        severity: 'Error',
        message: `Cannot change a ${instance.elemID.typeName} with side conversation actions since the feature is disabled in the account`,
        detailedMessage: `${instance.elemID.typeName} contains the following side conversation actions which are disabled in the account: ${instancesDisabledSCFields.join(', ')}.
Please enable side conversations in your account or remove those actions from the ${instance.elemID.typeName} in order to deploy.`,
      },
    ]
  })
}
