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
import { logger } from '@salto-io/logging'
import { CORE_ANNOTATIONS, Element } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { FilterCreator } from '../filter'
import { lightningElementsUrlRetriever } from '../elements_url_retreiver/elements_url_retreiver'
import { buildElementsSourceForFetch, extractFlatCustomObjectFields, ensureSafeFilterFetch, ensureFilterEnabled } from './utils'

const { awu } = collections.asynciterable

const log = logger(module)

const getRelevantElements = (elements: Element[]): AsyncIterable<Element> =>
  awu(elements)
    .flatMap(extractFlatCustomObjectFields)

const filterCreator: FilterCreator = ({ client, config }) => ({
  onFetch: ensureFilterEnabled(
    ensureSafeFilterFetch(
      async (elements: Element[]) => {
        const url = await client.getUrl()
        if (url === undefined) {
          log.error('Failed to get salesforce URL')
          return undefined
        }

        const referenceElements = buildElementsSourceForFetch(elements, config)
        const urlRetriever = lightningElementsUrlRetriever(url, id => referenceElements.get(id))

        if (urlRetriever === undefined) {
          log.error('Failed to get salesforce URL')
          return undefined
        }

        const updateElementUrl = async (element: Element): Promise<void> => {
          const elementURL = await urlRetriever.retrieveUrl(element)

          if (elementURL !== undefined) {
            element.annotations[CORE_ANNOTATIONS.SERVICE_URL] = elementURL.href
          }
        }

        await awu(getRelevantElements(elements)).forEach(
          async element => updateElementUrl(element)
        )
        return undefined
      },
      'Failed to unexpected error when adding services url to elements'
    ),
    'elementsUrls', config
  ),
})

export default filterCreator
