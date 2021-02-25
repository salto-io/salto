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
import { logger } from '@salto-io/logging'
import { formatSuiteQLDate } from '../formats'
import { TypeChangesDetector } from '../types'

const log = logger(module)

const changesDetector: TypeChangesDetector = {
  getChanges: async (client, dateRange) => {
    const results = await client.runSuiteQL(`
      SELECT scriptid
      FROM customrecordtype
      WHERE lastmodifieddate BETWEEN '${formatSuiteQLDate(dateRange.start)}' AND '${formatSuiteQLDate(dateRange.end)}'
    `)

    if (results === undefined) {
      log.warn('customrecordtype changes query failed')
      return []
    }

    return results
      .filter((res): res is { scriptid: string } => {
        if (typeof res.scriptid !== 'string') {
          log.warn('Got invalid result from customrecordtype query, %o', res)
          return false
        }
        return true
      })
      .map(res => ({
        type: 'object',
        externalId: res.scriptid,
      }))
  },
  getTypes: () => ([
    'customrecordtype',
    'customsegement',
  ]),
}

export default changesDetector
