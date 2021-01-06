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
import _ from 'lodash'
import wu from 'wu'
import { isCustomObject } from '../transformers/transformer'
import { FilterCreator } from '../filter'
import { lightiningElementsUrlRetreiver } from '../elements_url_retreiver/elements_url_retreiver'
import { ElementIDResolver } from '../elements_url_retreiver/lightining_url_resolvers'

const log = logger(module)

const createElementIdResolver = (elementsMap: Record<string, Element>): ElementIDResolver =>
  id => elementsMap[id.getFullName()]


const getRelevantElements = (elements: Element[]): wu.WuIterable<Element> =>
  wu(elements)
    .map(elem => (isCustomObject(elem) ? [elem, ...Object.values(elem.fields)] : [elem]))
    .flatten(true)


const filterCreator: FilterCreator = ({ client }) => ({
  onFetch: async (elements: Element[]): Promise<void> => {
    const url = await client.getUrl()
    if (url === undefined) {
      log.error('Failed to get salesforce URL')
      return
    }

    const elementsMap = _.keyBy(elements, element => element.elemID.getFullName())
    const urlRetreiver = lightiningElementsUrlRetreiver(url, createElementIdResolver(elementsMap))

    if (urlRetreiver === undefined) {
      log.error('Failed to get salesforce URL')
      return
    }

    const updateElementUrl = (element: Element): void => {
      const elementURL = urlRetreiver.retreiveUrl(element)

      if (elementURL !== undefined) {
        element.annotations[CORE_ANNOTATIONS.SERVICE_URL] = elementURL.href
      }
    }

    getRelevantElements(elements).forEach(element => updateElementUrl(element))
  },
})

export default filterCreator
