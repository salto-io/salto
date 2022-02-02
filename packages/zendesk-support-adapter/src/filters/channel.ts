/*
*                      Copyright 2022 Salto Labs Ltd.
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
  BuiltinTypes, CORE_ANNOTATIONS, ElemID, InstanceElement, isInstanceElement, ObjectType, Values,
} from '@salto-io/adapter-api'
import { naclCase } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { elements as elementsUtils } from '@salto-io/adapter-components'
import { FilterCreator } from '../filter'
import { ZENDESK_SUPPORT } from '../constants'

const log = logger(module)

const { RECORDS_PATH, SUBTYPES_PATH, TYPES_PATH } = elementsUtils

export const CHANNEL_TYPE_NAME = 'channel'
export const TRIGGER_DEFINITION_TYPE_NAME = 'trigger_definition'

/**
 * Adds the hardcoded channel instances
 */
const filterCreator: FilterCreator = ({ config }) => ({
  onFetch: async elements => {
    // We are ok with picking the first instance because triggerDefinition is a singleton
    const triggerDefinitionInstance = elements
      .filter(isInstanceElement)
      .find(e => e.elemID.typeName === TRIGGER_DEFINITION_TYPE_NAME)
    if (triggerDefinitionInstance === undefined) {
      log.warn('Failed to find trigger_definition instance. Does not add channel instances')
      return
    }
    const channels = (triggerDefinitionInstance.value.conditions_all ?? [])
      .find((condition: Values) => condition.title === 'Channel')?.values as (Values[] | undefined)
    if (channels === undefined) {
      log.warn('Failed to find the channels in trigger_definition instance. Does not add channel instances')
      return
    }
    const channelType = new ObjectType({
      elemID: new ElemID(ZENDESK_SUPPORT, CHANNEL_TYPE_NAME),
      fields: {
        id: {
          refType: BuiltinTypes.SERVICE_ID, annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true },
        },
        name: { refType: BuiltinTypes.STRING },
      },
      annotations: config.fetch.hideTypes ? { [CORE_ANNOTATIONS.HIDDEN]: true } : undefined,
      path: [ZENDESK_SUPPORT, TYPES_PATH, SUBTYPES_PATH, CHANNEL_TYPE_NAME],
    })
    const instances = channels.map(channel => {
      const instanceName = naclCase(channel.title)
      return new InstanceElement(
        instanceName,
        channelType,
        { id: channel.value, name: instanceName },
        [ZENDESK_SUPPORT, RECORDS_PATH, CHANNEL_TYPE_NAME, instanceName],
      )
    })
    // Those types already exist since we added the empty version of them
    //  via the add remaining types mechanism. So we first need to remove the old versions
    _.remove(elements, element => element.elemID.isEqual(channelType.elemID))
    elements.push(channelType, ...instances)
  },
})

export default filterCreator
