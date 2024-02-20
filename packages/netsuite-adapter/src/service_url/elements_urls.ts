/*
 *                      Copyright 2024 Salto Labs Ltd.
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
