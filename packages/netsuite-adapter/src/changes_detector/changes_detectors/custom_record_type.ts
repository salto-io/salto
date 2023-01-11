
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
import { removeCustomRecordTypePrefix } from '../../types'
import { convertSuiteQLStringToDate, SUITEQL_DATE_FORMAT } from '../date_formats'
import { ChangedObject, TypeChangesDetector } from '../types'

const log = logger(module)

const changesDetector: TypeChangesDetector = {
  getChanges: async (client, dateRange) => {
    const [startDate, endDate] = dateRange.toSuiteQLRange()

    const results = await client.runSuiteQL(`
        SELECT scriptid, TO_CHAR(lastmodifieddate, '${SUITEQL_DATE_FORMAT}') AS lastmodifieddate
        FROM customrecordtype
        WHERE lastmodifieddate BETWEEN ${startDate} AND ${endDate}
        ORDER BY scriptid ASC
      `)

    if (results === undefined) {
      log.warn('customrecordtype changes query failed')
      return []
    }

    const changes: ChangedObject[] = results
      .filter((res): res is { scriptid: string; lastmodifieddate: string } => {
        if ([res.scriptid, res.lastmodifieddate].some(val => typeof val !== 'string')) {
          log.warn('Got invalid result from customrecordtype query, %o', res)
          return false
        }
        return true
      })
      .map(res => ({
        type: 'object',
        externalId: res.scriptid,
        time: convertSuiteQLStringToDate(res.lastmodifieddate),
      }))

    // the script ids of the custom segments that are returned from the SDF
    // are returned without the 'customrecord_' prefix.
    const changesForCustomSegments: ChangedObject[] = changes.map(change => ({
      type: 'object',
      externalId: removeCustomRecordTypePrefix(change.externalId),
      time: change.time,
    }))

    return [
      ...changes,
      ...changesForCustomSegments,
    ]
  },
  getTypes: () => ([
    'customrecordtype',
    'customsegment',
  ]),
}

export default changesDetector
