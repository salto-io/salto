/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { logger } from '@salto-io/logging'
import { removeCustomRecordTypePrefix } from '../../types'
import { convertSuiteQLStringToDate, toSuiteQLSelectDateString } from '../date_formats'
import { ChangedObject, TypeChangesDetector } from '../types'

const log = logger(module)

const changesDetector: TypeChangesDetector = {
  getChanges: async (client, dateRange) => {
    const [startDate, endDate] = dateRange.toSuiteQLRange()

    const results = await client.runSuiteQL({
      select: `internalid, scriptid, ${toSuiteQLSelectDateString('lastmodifieddate')} AS time`,
      from: 'customrecordtype',
      where: `lastmodifieddate BETWEEN ${startDate} AND ${endDate}`,
      orderBy: 'internalid',
    })

    if (results === undefined) {
      log.warn('customrecordtype changes query failed')
      return []
    }

    const changes: ChangedObject[] = results
      .filter((res): res is { scriptid: string; time: string } => {
        if ([res.scriptid, res.time].some(val => typeof val !== 'string')) {
          log.warn('Got invalid result from customrecordtype query, %o', res)
          return false
        }
        return true
      })
      .map(res => ({
        type: 'object',
        objectId: res.scriptid,
        time: convertSuiteQLStringToDate(res.time, dateRange.end),
      }))

    // the script ids of the custom segments that are returned from the SDF
    // are returned without the 'customrecord_' prefix.
    const changesForCustomSegments: ChangedObject[] = changes.map(change => ({
      type: 'object',
      objectId: removeCustomRecordTypePrefix(change.objectId),
      time: change.time,
    }))

    return [...changes, ...changesForCustomSegments]
  },
  getTypes: () => ['customrecordtype', 'customsegment'],
}

export default changesDetector
