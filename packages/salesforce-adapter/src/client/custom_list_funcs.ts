/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { FileProperties } from '@salto-io/jsforce'
import { collections } from '@salto-io/lowerdash'
import { ReadOnlyElementsSource } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { CustomListFuncDef } from './client'
import { getChangedAtSingletonInstance } from '../filters/utils'
import { APEX_CLASS_METADATA_TYPE } from '../constants'

const { toArrayAsync } = collections.asynciterable
const log = logger(module)

const latestChangedInstanceOfType = async (
  elementsSource: ReadOnlyElementsSource,
  typeName: string,
): Promise<string | undefined> => {
  const singleton = await getChangedAtSingletonInstance(elementsSource)
  if (!singleton) {
    return undefined
  }
  const allChangedAtOfType = singleton.value[typeName]
  if (!_.isPlainObject(allChangedAtOfType)) {
    return undefined
  }
  return _.maxBy(Object.values(allChangedAtOfType).filter(_.isString), dateTime => new Date(dateTime).getTime())
}

export const createListApexClassesDef = (elementsSource: ReadOnlyElementsSource): CustomListFuncDef => ({
  func: async client => {
    const sinceDate = await latestChangedInstanceOfType(elementsSource, APEX_CLASS_METADATA_TYPE)
    if (sinceDate === undefined) {
      log.warn(
        'Expected latestChangedInstanceOfType ApexClass to be defined. Will query all of the ApexClasses instead',
      )
    }
    const query =
      'SELECT Id, NamespacePrefix, Name, CreatedDate, CreatedBy.Name, LastModifiedDate, LastModifiedBy.Name FROM ApexClass'
    const whereClause = sinceDate ? ` WHERE LastModifiedDate > ${sinceDate}` : ''
    const result = (await toArrayAsync(await client.queryAll(query.concat(whereClause)))).flat()
    const props = result.map((record): FileProperties => {
      const namespacePrefix = record.NamespacePrefix != null ? record.NamespacePrefix : undefined
      const fullName = namespacePrefix ? `${namespacePrefix}__${record.Name}` : record.Name
      return {
        id: record.Id,
        fullName,
        fileName: `classes/${fullName}.cls`,
        type: 'ApexClass',
        namespacePrefix,
        lastModifiedDate: record.LastModifiedDate,
        createdDate: record.CreatedDate,
        createdByName: record.CreatedBy.Name,
        lastModifiedByName: record.LastModifiedBy.Name,
        lastModifiedById: '',
        createdById: '',
      }
    })
    return { result: props, errors: [] }
  },
  isPartial: true,
})
