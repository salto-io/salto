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
import path from 'path'
import { logger } from '@salto-io/logging'
import { formatSuiteQLDate } from '../formats'
import { FileCabinetChangesDetector } from '../types'

const log = logger(module)


export const getChangedFiles: FileCabinetChangesDetector = async (client, dateRange) => {
  const results = await client.runSuiteQL(`
    SELECT mediaitemfolder.appfolder, file.name, file.id
    FROM file
    JOIN mediaitemfolder ON mediaitemfolder.id = file.folder
    WHERE file.lastmodifieddate BETWEEN '${formatSuiteQLDate(dateRange.start)}' AND '${formatSuiteQLDate(dateRange.end)}'
  `)

  if (results === undefined) {
    log.warn('file changes query failed')
    return []
  }

  return results
    .filter((res): res is { name: string; appfolder: string; id: string } => {
      if ([res.appfolder, res.name, res.id].some(val => typeof val !== 'string')) {
        log.warn('Got invalid result from file changes query, %o', res)
        return false
      }
      return true
    })
    .map(res => ({
      type: 'object',
      externalId: path.join('/', ...res.appfolder.split(' : '), res.name),
      internalId: parseInt(res.id, 10),
    }))
}

export const getChangedFolders: FileCabinetChangesDetector = async (client, dateRange) => {
  const results = await client.runSuiteQL(`
    SELECT appfolder, id
    FROM mediaitemfolder
    WHERE lastmodifieddate BETWEEN '${formatSuiteQLDate(dateRange.start)}' AND '${formatSuiteQLDate(dateRange.end)}'
  `)

  if (results === undefined) {
    log.warn('folders changes query failed')
    return []
  }

  return results
    .filter((res): res is { appfolder: string; id: string } => {
      if ([res.appfolder, res.id].some(val => typeof val !== 'string')) {
        log.warn('Got invalid result from folders changes query, %o', res)
        return false
      }
      return true
    })
    .map(res => ({
      type: 'object',
      externalId: path.join('/', ...res.appfolder.split(' : ')),
      internalId: parseInt(res.id, 10),
    }))
}
