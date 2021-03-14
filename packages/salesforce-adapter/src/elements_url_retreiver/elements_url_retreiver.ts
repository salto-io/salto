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
import { Element } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { values, collections } from '@salto-io/lowerdash'
import { ElementIDResolver, resolvers } from './lightining_url_resolvers'

const log = logger(module)

const { findAsync, mapAsync, toAsyncIterable } = collections.asynciterable

export type ElementsUrlRetriever = {
  retrieveUrl(element: Element): Promise<URL | undefined>
}


export const lightningElementsUrlRetriever = (baseUrl: URL, elementIDResolver: ElementIDResolver):
  ElementsUrlRetriever | undefined => {
  const suffix = baseUrl.origin.match(/(my\.)?salesforce\.com$/)
  if (suffix === null) {
    log.error(`Received invalid salesforce url: '${baseUrl.origin}'`)
    return undefined
  }
  const lightningUrl = new URL(`${baseUrl.origin.substr(0, suffix.index)}lightning.force.com`)

  const retrieveUrl = (element: Element): Promise<URL | undefined> => (
    findAsync(
      mapAsync(
        toAsyncIterable(resolvers),
        resolver => resolver(element, lightningUrl, elementIDResolver)
      ),
      values.isDefined,
    )
  )

  return {
    retrieveUrl,
  }
}
