/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { logger } from '@salto-io/logging'
import { TypeChangesDetector } from '../types'

const log = logger(module)

const changesDetector: TypeChangesDetector = {
  getChanges: async (client, dateRange) => {
    const results = await client.runSavedSearchQuery({
      type: 'systemnote',
      filters: [['recordtype', 'is', '-129'], 'and', ['date', 'within', ...dateRange.toSavedSearchRange()]],
      columns: ['recordid'],
    })

    if (results === undefined) {
      log.warn('workflow changes query failed')
      return []
    }

    if (results.length === 0) {
      return []
    }

    return [
      {
        type: 'type',
        name: 'workflow',
      },
    ]
  },
  getTypes: () => ['workflow'],
}

export default changesDetector
