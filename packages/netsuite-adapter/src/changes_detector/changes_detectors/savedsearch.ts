/*
 *                      Copyright 2024 Salto Labs Ltd.
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
