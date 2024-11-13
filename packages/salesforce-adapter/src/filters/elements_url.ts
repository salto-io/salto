/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { logger } from '@salto-io/logging'
import { CORE_ANNOTATIONS, Element } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { FilterCreator } from '../filter'
import { lightningElementsUrlRetriever } from '../elements_url_retriever/elements_url_retriever'
import { buildElementsSourceForFetch, extractFlatCustomObjectFields, ensureSafeFilterFetch } from './utils'

const { awu } = collections.asynciterable

const log = logger(module)

const getRelevantElements = (elements: Element[]): AsyncIterable<Element> =>
  awu(elements).flatMap(extractFlatCustomObjectFields)

export const WARNING_MESSAGE =
  'Encountered an error while trying to populate URLs for some of your salesforce configuration elements. This might affect the availability of the ‘go to service’ functionality in your workspace.'

const filterCreator: FilterCreator = ({ client, config }) => ({
  name: 'elementsUrlFilter',
  onFetch: ensureSafeFilterFetch({
    warningMessage: WARNING_MESSAGE,
    config,
    filterName: 'elementsUrls',
    fetchFilterFunc: async (elements: Element[]) => {
      if (client === undefined) {
        return
      }

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

      await awu(getRelevantElements(elements)).forEach(async element => updateElementUrl(element))
    },
  }),
})

export default filterCreator
