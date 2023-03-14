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
import Joi from 'joi'
import {
  BuiltinTypes, CORE_ANNOTATIONS, ElemID, InstanceElement, isInstanceElement, ObjectType, Values,
} from '@salto-io/adapter-api'
import { naclCase, safeJsonStringify, elementExpressionStringifyReplacer } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { elements as elementsUtils } from '@salto-io/adapter-components'
import { FilterCreator } from '../filter'
import { ZENDESK } from '../constants'

const log = logger(module)

const { RECORDS_PATH, SUBTYPES_PATH, TYPES_PATH } = elementsUtils

export const CHANNEL_TYPE_NAME = 'channel'
export const TRIGGER_DEFINITION_TYPE_NAME = 'trigger_definition'

type Channel = {
  value: string
  title: string
  enabled: boolean
}

const EXPECTED_CHANNELS_SCHEMA = Joi.array().items(Joi.object({
  value: Joi.string().required(),
  title: Joi.string().required(),
  enabled: Joi.boolean(),
})).required()

const isChannels = (values: unknown): values is Channel[] => {
  const { error } = EXPECTED_CHANNELS_SCHEMA.validate(values)
  if (error !== undefined) {
    log.error(`Received an invalid response for the channel values: ${error.message}, ${safeJsonStringify(values, elementExpressionStringifyReplacer)}`)
    return false
  }
  return true
}

/**
 * Adds the hardcoded channel instances in order to add references to them
 */
const filterCreator: FilterCreator = () => ({
  name: 'hardcodedChannelFilter',
  onFetch: async elements => {
    // We are ok with picking the first instance because triggerDefinition is a singleton
    const triggerDefinitionInstance = elements
      .filter(isInstanceElement)
      .find(e => e.elemID.typeName === TRIGGER_DEFINITION_TYPE_NAME)
    if (triggerDefinitionInstance === undefined) {
      log.warn(`Failed to find ${TRIGGER_DEFINITION_TYPE_NAME} instance. Not adding channel instances`)
      return
    }
    const channels = (triggerDefinitionInstance.value.conditions_all ?? [])
      // Both via_id and current_via_id should includes the same channels and both should appear
      .find((condition: Values) => ['via_id', 'current_via_id'].includes(condition?.subject))?.values
    if (!isChannels(channels)) {
      return
    }
    const channelType = new ObjectType({
      elemID: new ElemID(ZENDESK, CHANNEL_TYPE_NAME),
      fields: {
        id: {
          refType: BuiltinTypes.SERVICE_ID, annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true },
        },
        name: { refType: BuiltinTypes.STRING },
      },
      path: [ZENDESK, TYPES_PATH, SUBTYPES_PATH, CHANNEL_TYPE_NAME],
    })
    if (channels.length !== (new Set(channels.map(c => c.value))).size) {
      log.warn(`Found duplicate ids in the channels - Not adding channel instances. ${safeJsonStringify(channels)}`)
      return
    }
    const instances = channels.map(channel => {
      const instanceName = naclCase(channel.title)
      return new InstanceElement(
        instanceName,
        channelType,
        { id: channel.value, name: channel.title },
        [ZENDESK, RECORDS_PATH, CHANNEL_TYPE_NAME, instanceName],
      )
    })
    elements.push(channelType, ...instances)
  },
})

export default filterCreator
