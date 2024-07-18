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
import { FileProperties } from '@salto-io/jsforce'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { ReadOnlyElementsSource } from '@salto-io/adapter-api'
import { CustomListFunc } from './client'

const { toArrayAsync } = collections.asynciterable
const log = logger(module)

export const createListApexClassesFunc =
  async (_elementsSource?: ReadOnlyElementsSource): Promise<CustomListFunc> =>
  async (client) => {
    log.warn('Invoked custom listApexClasses')
    const sinceDate = undefined
    const query =
      'SELECT NamespacePrefix, Name, CreatedDate, CreatedBy.Name, LastModifiedDate, LastModifiedBy.Name FROM ApexClass'
    const whereClause = sinceDate
      ? ` WHERE LastModifiedDate > ${sinceDate}`
      : ''
    const result = (
      await toArrayAsync(await client.queryAll(query.concat(whereClause)))
    ).flat()
    const props = result.map((record): FileProperties => {
      const fullName = record.NamespacePrefix
        ? `${record.NamespacePrefix}__${record.Name}`
        : record.Name
      return {
        id: record.Id,
        fullName,
        fileName: `classes/${fullName}.cls`,
        type: 'ApexClass',
        namespacePrefix: record.NamespacePrefix,
        lastModifiedDate: record.LastModifiedDate,
        createdDate: record.CreatedDate,
        createdByName: record.CreatedBy.Name,
        lastModifiedByName: record.LastModifiedBy.Name,
        lastModifiedById: '',
        createdById: '',
      }
    })
    return props
  }
