/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { logger } from '@salto-io/logging'
import { convertSavedSearchStringToDate } from '../date_formats'
import { TypeChangesDetector } from '../types'

const log = logger(module)

const changesDetector: TypeChangesDetector = {
  getChanges: async (client, dateRange) => {
    const results = await client.runSavedSearchQuery({
      type: 'savedsearch',
      columns: ['id', 'datemodified'],
      filters: [['datemodified', 'within', ...dateRange.toSavedSearchRange()]],
    })

    if (results === undefined) {
      log.warn('savedsearch changes query failed')
      return []
    }

    return results
      .filter((res): res is { id: string; datemodified: string } => {
        if ([res.id, res.datemodified].some(val => typeof val !== 'string')) {
          log.warn('Got invalid result from savedsearch query, %o', res)
          return false
        }
        return true
      })
      .map(res => ({
        type: 'object',
        objectId: res.id,
        time: convertSavedSearchStringToDate(res.datemodified, dateRange.end),
      }))
  },
  getTypes: () => ['savedsearch'],
}

export default changesDetector
