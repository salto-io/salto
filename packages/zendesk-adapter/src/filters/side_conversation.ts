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
import { Element, InstanceElement, isInstanceElement, ReferenceExpression, Value } from '@salto-io/adapter-api'
import { references as referencesUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import joi from 'joi'
import { logger } from '@salto-io/logging'
import { createTemplateExpression } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import { GROUP_TYPE_NAME, ZENDESK } from '../constants'
import { FETCH_CONFIG, ZendeskConfig } from '../config'
import { TYPES_WITH_SIDE_CONVERSATIONS } from '../change_validators/side_conversation'

const log = logger(module)
const { createMissingInstance } = referencesUtils
const SIDE_CONVERSATION_FIELD_NAME = 'side_conversation_ticket'
const valueWithGroupRegex = /(?<prefix>.+\/group\/)(?<groupId>\d+)(?<suffix>.*)/
type SideConversationTicketAction = {
  field: string
  value: unknown[]
}
const sideConversationTicketActionSchema = joi
  .object({
    field: joi.string().valid(SIDE_CONVERSATION_FIELD_NAME).required(),
    value: joi.array().required(),
  })
  .unknown(true)
const isSideConversationTicketAction = (action: Value): action is SideConversationTicketAction =>
  sideConversationTicketActionSchema.validate(action).error === undefined

export const sideConversationsOnFetch = (elements: Element[], config: ZendeskConfig): void => {
  const relevantInstances = elements
    .filter(isInstanceElement)
    .filter(instance => TYPES_WITH_SIDE_CONVERSATIONS.includes(instance.elemID.typeName))
  const groupsById = _.keyBy(
    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === GROUP_TYPE_NAME)
      .filter(instance => instance.value.id !== undefined),
    instance => instance.value.id,
  )

  relevantInstances.forEach(instance => {
    const actions = instance.value.actions ?? []
    actions.filter(isSideConversationTicketAction).forEach((action: SideConversationTicketAction) => {
      // Handle cases of invalid array structure
      if (!_.isString(action.value[2])) {
        log.error('side conversation ticket action value is not a string', action.value[2])
        return
      }

      // Split the value to the rest of the string and just the groupId
      // action.value[2] type check is done in the if statement above
      const { prefix, groupId, suffix } = action.value[2].match(valueWithGroupRegex)?.groups ?? {}
      if (prefix === undefined || groupId === undefined) {
        return
      }

      if (!isInstanceElement(groupsById[groupId])) {
        if (config[FETCH_CONFIG].enableMissingReferences) {
          const missingInstance = createMissingInstance(ZENDESK, GROUP_TYPE_NAME, groupId)
          missingInstance.value.id = groupId
          // Replace the group part with a missing reference
          action.value[2] = createTemplateExpression({
            parts: [prefix, new ReferenceExpression(missingInstance.elemID, missingInstance), suffix],
          })
        }
        return
      }

      // Type check is done in the if statement above
      const group = groupsById[groupId] as InstanceElement
      // Replace the group part with a reference expression
      action.value[2] = createTemplateExpression({
        parts: [prefix, new ReferenceExpression(group.elemID, group), suffix],
      })
    })
  })
}

/**
 * Replaces groupId in side conversation ticket actions with a reference expression
 */
const filterCreator: FilterCreator = ({ config }) => ({
  name: 'sideConversationFilter',
  onFetch: async (elements: Element[]) => sideConversationsOnFetch(elements, config),
})

export default filterCreator
