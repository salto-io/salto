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
import NetsuiteClient from '../../client/client'
import { convertSuiteQLStringToDate } from '../date_formats'
import { ChangedObject, DateRange, TypeChangesDetector } from '../types'

const log = logger(module)

const getChanges = async (type: string, client: NetsuiteClient, dateRange: DateRange):
  Promise<ChangedObject[]> => {
  const [startDate, endDate] = dateRange.toSuiteQLRange()

  const results = await client.runSuiteQL(`
      SELECT scriptid, lastmodifieddate
      FROM ${type}
      WHERE lastmodifieddate BETWEEN '${startDate}' AND '${endDate}'
    `)

  if (results === undefined) {
    log.warn(`${type} changes query failed`)
    return []
  }

  return results
    .filter((res): res is { scriptid: string; lastmodifieddate: string } => {
      if ([res.scriptid, res.lastmodifieddate].some(val => typeof val !== 'string')) {
        log.warn(`Got invalid result from ${type} query, %o`, res)
        return false
      }
      return true
    })
    .map(res => ({
      type: 'object',
      externalId: res.scriptid,
      time: convertSuiteQLStringToDate(res.lastmodifieddate),
    }))
}

export const customRecordTypeDetector: TypeChangesDetector = {
  getChanges: async (client, dateRange) => getChanges('customrecordtype', client, dateRange),
  getTypes: () => (['customrecordtype', 'customsegement']),
}

export const customListDetector: TypeChangesDetector = {
  getChanges: async (client, dateRange) => getChanges('customlist', client, dateRange),
  getTypes: () => (['customlist']),
}

export const customFieldDetector: TypeChangesDetector = {
  getChanges: async (client, dateRange) => getChanges('customfield', client, dateRange),
  getTypes: () => ([
    'entitycustomfield',
    'transactionbodycustomfield',
    'transactioncolumncustomfield',
    'itemcustomfield',
    'othercustomfield',
    'itemoptioncustomfield',
    'itemnumbercustomfield',
    'crmcustomfield',
    'customfield',
  ]),
}
