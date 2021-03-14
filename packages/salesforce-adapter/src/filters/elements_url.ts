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
import wu from 'wu'
import { logger } from '@salto-io/logging'
import { CORE_ANNOTATIONS, Element } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { lightningElementsUrlRetriever } from '../elements_url_retreiver/elements_url_retreiver'
import { buildElementsSourceForFetch, extractFlatCustomObjectFields } from './utils'

const log = logger(module)

const getRelevantElements = (elements: Element[]): wu.WuIterable<Element> =>
  wu(elements).map(extractFlatCustomObjectFields).flatten(true)

const filterCreator: FilterCreator = ({ client, config }) => ({
  onFetch: async (elements: Element[]): Promise<void> => {
    const url = await client.getUrl()
    if (url === undefined) {
      log.error('Failed to get salesforce URL')
      return
    }

    const referenceElements = buildElementsSourceForFetch(elements, config)
    const urlRetriever = lightningElementsUrlRetriever(url, id => referenceElements.get(id))

    if (urlRetriever === undefined) {
      log.error('Failed to get salesforce URL')
      return
    }

    const updateElementUrl = async (element: Element): Promise<void> => {
      const elementURL = await urlRetriever.retrieveUrl(element)

      if (elementURL !== undefined) {
        element.annotations[CORE_ANNOTATIONS.SERVICE_URL] = elementURL.href
      }
    }

    await Promise.all(
      getRelevantElements(elements).map(element => updateElementUrl(element))
    )
  },
})

export default filterCreator
