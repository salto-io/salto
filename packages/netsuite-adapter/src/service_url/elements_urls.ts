/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/

import { CORE_ANNOTATIONS, Element } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import NetsuiteClient from '../client/client'
import { getInternalId } from '../types'

const log = logger(module)

export const setElementsUrls = <T extends Element>({
  elements,
  client,
  filter,
  generateUrl,
}: {
  elements: T[]
  client: NetsuiteClient
  filter: (element: T) => boolean
  generateUrl: (id: number, element: T) => string | undefined
}): void => {
  const relevantElements = elements.filter(e => filter(e))
  if (relevantElements.length === 0) {
    return
  }

  relevantElements.forEach(element => {
    const id = getInternalId(element)
    if (id === undefined) {
      log.warn(`Did not find the internal id of ${element.elemID.getFullName()}`)
      return
    }

    const url = generateUrl(id, element)
    if (url !== undefined) {
      element.annotations[CORE_ANNOTATIONS.SERVICE_URL] = new URL(url, client.url).href
    }
  })
}
