/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { CONTENT_TYPE_HEADER } from '../constants'

export const FORCE_ACCEPT_LANGUAGE_HEADERS = {
  'Accept-Language': 'en-US',
  'X-Force-Accept-Language': 'true',
}

export const EXPERIMENTAL_API_HEADERS = {
  'X-ExperimentalApi': 'opt-in',
}

export const PRIVATE_API_HEADERS = {
  'X-Atlassian-Token': 'no-check',
}

export const JSP_API_HEADERS = {
  ...PRIVATE_API_HEADERS,
  [CONTENT_TYPE_HEADER]: 'application/x-www-form-urlencoded',
}
