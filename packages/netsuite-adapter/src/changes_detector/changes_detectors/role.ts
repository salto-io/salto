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
import { convertSavedSearchStringToDate, convertSuiteQLStringToDate, toSuiteQLSelectDateString } from '../date_formats'
import { ChangedObject, DateRange, TypeChangesDetector } from '../types'

const log = logger(module)

const parseGeneralRolesChanges = (
  changes: Record<string, unknown>[] | undefined,
  dateRange: DateRange,
): ChangedObject[] => {
  if (changes === undefined) {
    log.warn('general roles changes query failed')
    return []
  }
  return changes
    .filter((res): res is { scriptid: string; time: string } => {
      if ([res.scriptid, res.time].some(val => typeof val !== 'string')) {
        log.warn('Got invalid result from roles changes query, %o', res)
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

const parsePermissionRolesChanges = (
  permissionChanges: Record<string, unknown>[] | undefined,
  allRoles: Record<string, unknown>[] | undefined,
  dateRange: DateRange,
): ChangedObject[] => {
  if (permissionChanges === undefined) {
    log.warn('permission roles changes query failed')
    return []
  }

  if (allRoles === undefined) {
    log.warn('all roles changes query failed')
    return []
  }

  const internalToExternalId = Object.fromEntries(
    allRoles
      .filter((res): res is { scriptid: string; id: string } => {
        if ([res.scriptid, res.id].some(val => typeof val !== 'string')) {
          log.warn('Got invalid result from all roles query, %o', res)
          return false
        }
        return true
      })
      .map(res => [parseInt(res.id, 10), res.scriptid]),
  )

  const changesInternalIds = permissionChanges
    .filter((res): res is { internalid: [{ value: string }]; permchangedate: string } => {
      if (
        !Array.isArray(res.internalid) ||
        typeof res.internalid[0] !== 'object' ||
        typeof (res.internalid[0] as Record<string, unknown>).value !== 'string' ||
        typeof res.permchangedate !== 'string'
      ) {
        log.warn('Got invalid result from roles permission changes query, %o', res)
        return false
      }
      return true
    })
    .map(res => ({
      id: parseInt(res.internalid[0].value, 10),
      time: convertSavedSearchStringToDate(res.permchangedate, dateRange.end),
    }))

  return changesInternalIds
    .filter(({ id }) => id in internalToExternalId)
    .map(({ id, time }) => ({
      type: 'object',
      objectId: internalToExternalId[id],
      time,
    }))
}

const changesDetector: TypeChangesDetector = {
  getChanges: async (client, dateRange) => {
    const [startDate, endDate] = dateRange.toSuiteQLRange()

    const rolesChangesPromise = client.runSuiteQL(`
      SELECT role.scriptid, ${toSuiteQLSelectDateString('MAX(systemnote.date)')} as time
      FROM role
      JOIN systemnote ON systemnote.recordid = role.id
      WHERE systemnote.date BETWEEN ${startDate} AND ${endDate} AND systemnote.recordtypeid = -118
      GROUP BY role.scriptid
      ORDER BY role.scriptid ASC
    `)

    const permissionChangesPromise = client.runSavedSearchQuery({
      type: 'role',
      columns: ['internalid', 'permchangedate'],
      filters: [['permchangedate', 'within', ...dateRange.toSavedSearchRange()]],
    })

    const allRolesPromise = client.runSuiteQL(`
      SELECT scriptid, id
      FROM role
      ORDER BY id ASC
    `)

    const [rolesChanges, permissionChanges, allRoles] = await Promise.all([
      rolesChangesPromise,
      permissionChangesPromise,
      allRolesPromise,
    ])

    return [
      ...parseGeneralRolesChanges(rolesChanges, dateRange),
      ...parsePermissionRolesChanges(permissionChanges, allRoles, dateRange),
    ]
  },
  getTypes: () => ['role'],
}

export default changesDetector
