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
import { Element, ElementIDResolver, ElemID, isElement } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { values } from '@salto-io/lowerdash'
import { getInstanceUrl } from '../instance_url'
import { resolvers } from './lightining_url_resolvers'

const log = logger(module)

export type ElementsUrlRetreiver = {
  retreiveUrl(element: Element): Promise<URL | undefined>
  retreiveBaseUrl(): URL
}


export const lightiningElementsUrlRetreiver = (baseUrl: URL, elementIDResolver: ElementIDResolver):
  ElementsUrlRetreiver | undefined => {
  const suffix = baseUrl.origin.match(/my.salesforce.com$/)
  if (suffix === null) {
    log.error(`Received invalid salesforce url: '${baseUrl.origin}'`)
    return undefined
  }
  const lightiningUrl = new URL(`${baseUrl.origin.substr(0, suffix.index)}lightning.force.com`)

  const retreiveUrl = async (element: Element): Promise<URL | undefined> =>
    ((await Promise.all(
      resolvers.map(resolver => resolver(element, lightiningUrl, elementIDResolver))
    )).find(values.isDefined))

  return {
    retreiveUrl,
    retreiveBaseUrl: () => new URL(`${lightiningUrl}lightning/setup/SetupOneHome/home`),
  }
}

export const getElementUrl = async (id: ElemID, elementIDResolver: ElementIDResolver):
  Promise<URL | undefined> => {
  const instanceUrl = await getInstanceUrl(elementIDResolver)
  if (instanceUrl === undefined) {
    log.error('Failed to find instanceUrl')
    return undefined
  }

  const urlRetreiver = lightiningElementsUrlRetreiver(instanceUrl, elementIDResolver)
  if (urlRetreiver === undefined) {
    log.error('Failed to create url retreiver')
    return undefined
  }

  const element = await elementIDResolver(id)
  if (!isElement(element)) {
    log.error(`Failed to resolve element: ${id.getFullName()}`)
    return urlRetreiver.retreiveBaseUrl()
  }

  const url = await urlRetreiver.retreiveUrl(element)
  if (url === undefined) {
    log.error(`Failed to retreive url for id ${id.getFullName()}`)
    return urlRetreiver.retreiveBaseUrl()
  }
  return url
}
