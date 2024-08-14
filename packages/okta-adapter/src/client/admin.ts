/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { logger } from '@salto-io/logging'

const log = logger(module)

/**
 * Each Okta org has an administrator URL which is used to sign in to the admin console
 * and used in order to fetch data from private APIs
 * For more info: https://developer.okta.com/docs/concepts/okta-organizations/#org-urls
 */
export const getAdminUrl = (baseUrl: string): string | undefined => {
  const ADMIN_SUFFIX = '-admin'
  const urlParts = baseUrl.split('.')
  if (urlParts.length < 3) {
    log.error(`Could not add '-admin' to subdomain for baseUrl: ${baseUrl}`)
    return undefined
  }
  const subdomain = urlParts[0]
  if (subdomain.endsWith(ADMIN_SUFFIX)) {
    log.warn(`Subdomain already includes '-admin', using original baseUrl: ${baseUrl}`)
    return baseUrl
  }
  urlParts[0] = subdomain.concat(ADMIN_SUFFIX)
  return urlParts.join('.')
}
