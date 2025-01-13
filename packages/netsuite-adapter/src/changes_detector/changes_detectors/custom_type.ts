/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { logger } from '@salto-io/logging'
import { FIELD_TYPES } from '../../types'
import NetsuiteClient from '../../client/client'
import { convertSuiteQLStringToDate, toSuiteQLSelectDateString } from '../date_formats'
import { ChangedObject, DateRange, TypeChangesDetector } from '../types'

const log = logger(module)

const getChanges = async (type: string, client: NetsuiteClient, dateRange: DateRange): Promise<ChangedObject[]> => {
  const [startDate, endDate] = dateRange.toSuiteQLRange()

  const results = await client.runSuiteQL({
    select: `internalid, scriptid, ${toSuiteQLSelectDateString('lastmodifieddate')} AS time`,
    from: type,
    where: `lastmodifieddate BETWEEN ${startDate} AND ${endDate}`,
    orderBy: 'internalid',
  })

  if (results === undefined) {
    log.warn(`${type} changes query failed`)
    return []
  }

  return results
    .filter((res): res is { scriptid: string; time: string } => {
      if ([res.scriptid, res.time].some(val => typeof val !== 'string')) {
        log.warn(`Got invalid result from ${type} query, %o`, res)
        return false
      }
      return true
    })
    .map(res => ({
      type: 'object',
      objectId: res.scriptid,
      time: convertSuiteQLStringToDate(res.time, dateRange.end),
    }))
}

export const customListDetector: TypeChangesDetector = {
  getChanges: async (client, dateRange) => getChanges('customlist', client, dateRange),
  getTypes: () => ['customlist'],
}

export const customFieldDetector: TypeChangesDetector = {
  getChanges: async (client, dateRange) => getChanges('customfield', client, dateRange),
  getTypes: () => FIELD_TYPES,
}
