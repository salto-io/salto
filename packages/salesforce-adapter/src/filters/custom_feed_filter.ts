/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { values } from '@salto-io/lowerdash'
import { FileProperties } from 'jsforce-types'
import { Element, ElemID } from '@salto-io/adapter-api'
import { findObjectType } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import { ConfigChangeSuggestion } from '../types'
import { fetchMetadataInstances, listMetadataObjects } from '../fetch'
import { SALESFORCE } from '../constants'

export const CUSTOM_FEED_FILTER_METADATA_TYPE = 'CustomFeedFilter'
export const CUSTOM_FEED_FILTER_METADATA_TYPE_ID = new ElemID(
  SALESFORCE, CUSTOM_FEED_FILTER_METADATA_TYPE
)

const fixCustomFeedFullName = (props: FileProperties): FileProperties => ({
  ...props, fullName: `Case.${props.fullName}`,
})

const filterCreator: FilterCreator = ({ client, config }) => ({
  onFetch: async (elements: Element[]): Promise<ConfigChangeSuggestion[]> => {
    const customFeedFilterType = findObjectType(
      elements, CUSTOM_FEED_FILTER_METADATA_TYPE_ID
    )
    if (customFeedFilterType === undefined) {
      return []
    }
    const { elements: fileProps, configChanges } = await listMetadataObjects(
      client, CUSTOM_FEED_FILTER_METADATA_TYPE, [],
    )
    const instances = await fetchMetadataInstances({
      client,
      fileProps: fileProps.map(fixCustomFeedFullName),
      metadataType: customFeedFilterType,
      instancesRegexSkippedList: config.fetch?.metadata?.exclude?.map(x => x?.metadataType)
        .filter(values.isDefined).map(x => new RegExp(x)),
    })
    instances.elements.forEach(e => elements.push(e))
    return [...instances.configChanges, ...configChanges]
  },
})

export default filterCreator
