/*
*                      Copyright 2023 Salto Labs Ltd.
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

const log = logger(module)

/**
 * Extract id from okta's _links object urls
 * Example url: https://subdomain.okta.com/api/v1/group/abc123
 */
export const extractIdFromUrl = (url: string): string | undefined => {
  if (url.includes('/')) {
    const urlParts = url.split('/')
    return urlParts.pop()
  }
  log.warn(`Failed to extract id from url: ${url}`)
  return undefined
}
