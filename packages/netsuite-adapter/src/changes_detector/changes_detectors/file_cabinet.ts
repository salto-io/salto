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
import path from 'path'
import { logger } from '@salto-io/logging'
import { FileCabinetChangesDetector } from '../types'
import { convertSuiteQLStringToDate, toSuiteQLSelectDateString } from '../date_formats'

const log = logger(module)

export const getChangedFiles: FileCabinetChangesDetector = async (client, dateRange) => {
  const [startDate, endDate] = dateRange.toSuiteQLRange()

  const results = await client.runSuiteQL(`
    SELECT mediaitemfolder.appfolder, file.name, ${toSuiteQLSelectDateString('file.lastmodifieddate')} as time
    FROM file
    JOIN mediaitemfolder ON mediaitemfolder.id = file.folder
    WHERE file.lastmodifieddate BETWEEN ${startDate} AND ${endDate}
    ORDER BY file.id ASC
  `)

  if (results === undefined) {
    log.warn('file changes query failed')
    return []
  }
  return results
    .filter((res): res is { name: string; appfolder: string; time: string } => {
      if ([res.appfolder, res.name, res.time].some(val => typeof val !== 'string')) {
        log.warn('Got invalid result from file changes query, %o', res)
        return false
      }
      return true
    })
    .map(res => ({
      type: 'object',
      objectId: path.join('/', ...res.appfolder.split(' : '), res.name),
      time: convertSuiteQLStringToDate(res.time, dateRange.end),
    }))
}

export const getChangedFolders: FileCabinetChangesDetector = async (client, dateRange) => {
  const [startDate, endDate] = dateRange.toSuiteQLRange()

  const results = await client.runSuiteQL(`
    SELECT appfolder, ${toSuiteQLSelectDateString('lastmodifieddate')} as time
    FROM mediaitemfolder
    WHERE lastmodifieddate BETWEEN ${startDate} AND ${endDate}
    ORDER BY id ASC
  `)

  if (results === undefined) {
    log.warn('folders changes query failed')
    return []
  }

  return results
    .filter((res): res is { appfolder: string; time: string } => {
      if ([res.appfolder, res.time].some(val => typeof val !== 'string')) {
        log.warn('Got invalid result from folders changes query, %o', res)
        return false
      }
      return true
    })
    .map(res => ({
      type: 'object',
      objectId: path.join('/', ...res.appfolder.split(' : ')),
      time: convertSuiteQLStringToDate(res.time, dateRange.end),
    }))
}
