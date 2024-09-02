/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Element } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { values, collections } from '@salto-io/lowerdash'
import { ElementIDResolver, resolvers } from './lightning_url_resolvers'

const log = logger(module)
const { awu } = collections.asynciterable

export type ElementsUrlRetriever = {
  retrieveUrl(element: Element): Promise<URL | undefined>
}

export const lightningElementsUrlRetriever = (
  baseUrl: URL,
  elementIDResolver: ElementIDResolver,
): ElementsUrlRetriever | undefined => {
  const suffix = baseUrl.origin.match(/(my\.)?salesforce\.com$/)
  if (suffix === null) {
    log.error(`Received invalid salesforce url: '${baseUrl.origin}'`)
    return undefined
  }
  const lightningUrl = new URL(`${baseUrl.origin.substr(0, suffix.index)}lightning.force.com`)

  const retrieveUrl = async (element: Element): Promise<URL | undefined> =>
    awu(resolvers)
      .map(resolver => resolver(element, lightningUrl, elementIDResolver))
      .find(values.isDefined)

  return {
    retrieveUrl,
  }
}
