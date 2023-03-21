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
import {
  Element,
  InstanceElement,
  isInstanceElement,
  ReferenceExpression,
  TemplateExpression,
  Value,
} from '@salto-io/adapter-api'
import { values as lowerdashValues } from '@salto-io/lowerdash'
import _ from 'lodash'
import { FilterCreator } from '../filter'
import { GROUP_TYPE_NAME, MACRO_TYPE_NAME, TRIGGER_TYPE_NAME, ZENDESK } from '../constants'
import { createMissingInstance } from './references/missing_references'
import { FETCH_CONFIG } from '../config'

const { isDefined } = lowerdashValues

const SIDE_CONVERSATION_FIELD_NAME = 'side_conversation_ticket'
const valueWithGroupRegex = /(?<prefix>.+\/group\/)(?<groupId>\d+)/

type SideConversationTicketAction = {
    field: string
    value: unknown[]
}

const isSideConversationTicketAction = (action: Value): action is SideConversationTicketAction =>
  isDefined(action) && action.field === SIDE_CONVERSATION_FIELD_NAME && Array.isArray(action.value)


const filterCreator: FilterCreator = ({ config }) => ({
  name: 'sideConversationFilter',
  onFetch: async (elements: Element[]) => {
    const relevantInstances = elements.filter(isInstanceElement)
      .filter(instance => [TRIGGER_TYPE_NAME, MACRO_TYPE_NAME].includes(instance.elemID.typeName))
    const groupsById = _.keyBy(
      elements.filter(isInstanceElement).filter(instance => instance.elemID.typeName === GROUP_TYPE_NAME),
      instance => instance.value.id
    )

    relevantInstances.forEach(instance => {
      const actions = instance.value.actions ?? []
      actions.filter(isSideConversationTicketAction).forEach((action: SideConversationTicketAction) => {
        // Avoid bugs
        if (typeof action.value[2] !== 'string') {
          return
        }

        const { prefix, groupId } = action.value[2].match(valueWithGroupRegex)?.groups ?? {}
        if (prefix === undefined || groupId === undefined) {
          return
        }

        if (!isInstanceElement(groupsById[groupId])) {
          if (config[FETCH_CONFIG].enableMissingReferences) {
            const missingInstance = createMissingInstance(ZENDESK, GROUP_TYPE_NAME, groupId)
            // Replace the group part with a missing reference
            action.value[2] = new TemplateExpression({
              parts: [
                prefix,
                new ReferenceExpression(missingInstance.elemID, missingInstance),
              ],
            })
          }
          return
        }

        // Type check is done in the if statement above
        const group = groupsById[groupId] as InstanceElement
        // Replace the group part with a reference expression
        action.value[2] = new TemplateExpression({ parts: [
          prefix,
          new ReferenceExpression(group.elemID, group),
        ] })
      })
    })
  },
})

export default filterCreator
