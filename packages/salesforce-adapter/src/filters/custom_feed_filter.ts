/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { Element, InstanceElement, ObjectType, ElemID } from '@salto-io/adapter-api'
import { findObjectType } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { FilterCreator } from '../filter'
import { createInstanceElement } from '../transformers/transformer'
import SalesforceClient from '../client/client'
import { FetchElements, ConfigChangeSuggestion, FilterContext } from '../types'
import { createSkippedListConfigChange } from '../config_change'
import { SALESFORCE } from '../constants'

const { makeArray } = collections.array

export const CUSTOM_FEED_FILTER_METADATA_TYPE = 'CustomFeedFilter'
export const CUSTOM_FEED_FILTER_METADATA_TYPE_ID = new ElemID(
  SALESFORCE, CUSTOM_FEED_FILTER_METADATA_TYPE
)

const createInstances = async (
  client: SalesforceClient,
  config: FilterContext,
  customFeedFilterType: ObjectType,
  instancesNames: string[],
): Promise<FetchElements<InstanceElement[]>> => {
  const { result: metadataInfos, errors } = await client.readMetadata(
    CUSTOM_FEED_FILTER_METADATA_TYPE,
    instancesNames.map(name => `Case.${name}`)
      .filter(name => !((config.instancesRegexSkippedList ?? [])
        .some(re => re.test(`${CUSTOM_FEED_FILTER_METADATA_TYPE}.${name}`)))),
  )
  return {
    elements: metadataInfos
      .filter(m => m.fullName !== undefined)
      .map(m => createInstanceElement(m, customFeedFilterType)),
    configChanges: makeArray(errors)
      .map(e => createSkippedListConfigChange(CUSTOM_FEED_FILTER_METADATA_TYPE, e)),
  }
}

const filterCreator: FilterCreator = ({ client, config }) => ({
  onFetch: async (elements: Element[]): Promise<ConfigChangeSuggestion[]> => {
    const customFeedFilterMetadataValue = findObjectType(
      elements, CUSTOM_FEED_FILTER_METADATA_TYPE_ID
    )
    if (customFeedFilterMetadataValue === undefined) {
      return []
    }
    // Fetch list of all custom feed filters
    const { result: customFeedFilterList } = await client.listMetadataObjects(
      { type: CUSTOM_FEED_FILTER_METADATA_TYPE },
      // All errors are considered to be unhandled errors. If an error occur, throws an exception
      () => true
    )

    const instances = await createInstances(
      client, config, customFeedFilterMetadataValue, customFeedFilterList.map(e => e.fullName)
    )
    instances.elements.forEach(e => elements.push(e))
    return instances.configChanges
  },
})

export default filterCreator
