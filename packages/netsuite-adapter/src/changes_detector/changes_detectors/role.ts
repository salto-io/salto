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
import { formatSavedSearchDateRange, formatSuiteQLDateRange } from '../formats'
import { ChangedObject, TypeChangesDetector } from '../types'

const log = logger(module)

const parseGeneralRolesChanges = (changes?: Record<string, unknown>[]): ChangedObject[] => {
  if (changes === undefined) {
    log.warn('general roles changes query failed')
    return []
  }
  return changes.filter((res): res is { scriptid: string; id: string } => {
    if ([res.scriptid, res.id].some(val => typeof val !== 'string')) {
      log.warn('Got invalid result from roles changes query, %o', res)
      return false
    }
    return true
  }).map(res => ({
    type: 'object',
    externalId: res.scriptid,
    internalId: parseInt(res.id, 10),
  }))
}

const parsePermissionRolesChanges = (
  permissionChanges?: Record<string, unknown>[],
  allRoles?: Record<string, unknown>[]
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
      }).map(res => ([parseInt(res.id, 10), res.scriptid]))
  )

  const changesInternalIds = permissionChanges
    .filter((res): res is { internalid: [{ value: string }] } => {
      if (!Array.isArray(res.internalid) || typeof res.internalid[0] !== 'object' || typeof (res.internalid[0] as Record<string, unknown>).value !== 'string') {
        log.warn('Got invalid result from roles permission changes query, %o', res)
        return false
      }
      return true
    }).map(res => parseInt(res.internalid[0].value, 10))

  return changesInternalIds
    .filter(id => id in internalToExternalId)
    .map(id => ({ type: 'object', externalId: internalToExternalId[id] }))
}

const changesDetector: TypeChangesDetector = {
  getChanges: async (client, dateRange) => {
    const [startDate, endDate] = formatSuiteQLDateRange(dateRange)

    const rolesChangesPromise = client.runSuiteQL(`
      SELECT role.scriptid, role.id
      FROM role
      JOIN systemnote ON systemnote.recordid = role.id
      WHERE systemnote.date BETWEEN '${startDate}' AND '${endDate}' AND systemnote.recordtypeid = -118
    `)

    const permissionChangesPromise = client.runSavedSearchQuery({
      type: 'role',
      columns: ['internalid'],
      filters: [['permchangedate', 'within', ...formatSavedSearchDateRange(dateRange)]],
    })

    const allRolesPromise = client.runSuiteQL(`
      SELECT scriptid, id
      FROM role
    `)

    const [
      rolesChanges,
      permissionChanges,
      allRoles,
    ] = await Promise.all([rolesChangesPromise, permissionChangesPromise, allRolesPromise])

    return [
      ...parseGeneralRolesChanges(rolesChanges),
      ...parsePermissionRolesChanges(permissionChanges, allRoles),
    ]
  },
  getTypes: () => ([
    'role',
  ]),
}

export default changesDetector
