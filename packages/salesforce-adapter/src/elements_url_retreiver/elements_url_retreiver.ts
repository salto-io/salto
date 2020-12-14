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

import { Element, ElementResolver } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { resolversCreators } from './lightining_url_resolvers'

const log = logger(module)

export type ElementsUrlRetreiver = {
  retreiveUrl(element: Element): Promise<URL | undefined>
  retreiveBaseUrl(): URL
}


export const lightiningElementsUrlRetreiver = (baseUrl: URL, elementResolver: ElementResolver):
  ElementsUrlRetreiver | undefined => {
  const suffix = baseUrl.origin.match(/my.salesforce.com$/)
  if (suffix === null) {
    log.error(`Received invalid salesforce url: '${baseUrl.origin}'`)
    return undefined
  }
  const lightiningUrl = new URL(`${baseUrl.origin.substr(0, suffix.index)}lightning.force.com`)

  const retreiveUrl = async (element: Element): Promise<URL | undefined> => {
    for (const resolverCreator of resolversCreators) {
      const resolver = resolverCreator(element, elementResolver)
      // eslint-disable-next-line no-await-in-loop
      if (await resolver.shouldResolve()) {
        return resolver.resolve(lightiningUrl)
      }
    }
    return undefined
  }
  return {
    retreiveUrl,
    retreiveBaseUrl: () => lightiningUrl,
  }
}
