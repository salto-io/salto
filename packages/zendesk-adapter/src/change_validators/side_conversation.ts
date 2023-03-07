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
import _ from 'lodash'
import { ChangeValidator, ElemID, getChangeData, InstanceElement, isAdditionOrModificationChange, isInstanceChange, isInstanceElement } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { ACCOUNT_FEATURES_TYPE_NAME, MACRO_TYPE_NAME, ZENDESK } from '../constants'
import { ActionsType, isAction } from './macro_actions'

const log = logger(module)

// Map side conversation field name in macro instances to side conversation feature name in the account feature instance
const SIDE_CONVERSATION_MAP: Record<string, string> = {
  side_conversation: 'side_conversations_email',
  side_conversation_slack: 'side_conversations_slack',
  side_conversation_ticket: 'side_conversations_tickets',
}

const getSideConversationFields = (macroInstance: InstanceElement): string[] => (
  (macroInstance.value.actions ?? [])
    .filter(isAction)
    .filter((action: ActionsType) =>
      _.isString(action.field) && Object.keys(SIDE_CONVERSATION_MAP).includes(action.field))
    .map((action: ActionsType) => action.field)
)

/**
 * Verify side_conversation features are enabled before deployment of a macro with side_conversation fields
 */
export const sideConversationsValidator: ChangeValidator = async (
  changes, elementSource
) => {
  if (elementSource === undefined) {
    log.error('Failed to run sideConversationsValidator because no element source was provided')
    return []
  }

  const relevantInstances = changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === MACRO_TYPE_NAME)
    .filter(macroInstance => !_.isEmpty(getSideConversationFields(macroInstance)))
  if (_.isEmpty(relevantInstances)) {
    return []
  }

  const featureInstance = await elementSource.get(
    new ElemID(ZENDESK, ACCOUNT_FEATURES_TYPE_NAME, 'instance', ElemID.CONFIG_NAME)
  )
  if (!isInstanceElement(featureInstance)) {
    log.error(`Failed to run sideConversationsValidator because ${ACCOUNT_FEATURES_TYPE_NAME} instance was not found`)
    return []
  }
  const accountDisabledSCFields = Object.keys(SIDE_CONVERSATION_MAP)
    .filter(fieldOption => featureInstance.value[SIDE_CONVERSATION_MAP[fieldOption]]?.enabled !== true)

  return relevantInstances.flatMap(macroInstance => {
    const macrosDisabledSCFields = _.uniq(getSideConversationFields(macroInstance))
      .filter(fieldName => accountDisabledSCFields.includes(fieldName))
    if (_.isEmpty(macrosDisabledSCFields)) {
      return []
    }
    return [{
      elemID: macroInstance.elemID,
      severity: 'Error',
      message: 'Cannot change a macro with side conversation actions since the feature is disabled in the account',
      detailedMessage: `Macro contains the following side conversation actions which are disabled in the account: ${macrosDisabledSCFields.join(', ')}.
Please enable side conversations in your account or remove those actions from the macro in order to deploy.`,
    }]
  })
}
