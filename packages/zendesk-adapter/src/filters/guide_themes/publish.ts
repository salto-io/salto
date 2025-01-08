/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { logger } from '@salto-io/logging'
import ZendeskClient from '../../client/client'

const log = logger(module)

export const publish = async (themeId: string, client: ZendeskClient): Promise<string[]> => {
  const response = await client.post({ url: `/api/v2/guide/theming/themes/${themeId}/publish` })
  if (response.status !== 200) {
    log.error(`Failed to publish theme ${themeId}. Received status code ${response.status}`)
    return [`Failed to publish theme ${themeId}. Received status code ${response.status}`]
  }
  return []
}
