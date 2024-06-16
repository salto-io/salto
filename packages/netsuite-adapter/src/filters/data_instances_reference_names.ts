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
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import NetsuiteClient from '../client/client'
import { RemoteFilterCreator } from '../filter'
import { INTERNAL_ID, NAME_FIELD } from '../constants'

const log = logger(module)

const { makeArray } = collections.array

type ReferenceNameParams = {
  typeName: string
  fieldName: string
  suiteQLTableName: string
}

const REFERENCE_NAMES_PARAMS: ReferenceNameParams[] = [
  {
    typeName: 'account',
    fieldName: 'restrictToAccountingBookList',
    suiteQLTableName: 'accountingbook',
  },
]

const querySuiteQLTable = async (
  client: NetsuiteClient,
  tableName: string,
  internalIds: string[],
): Promise<Record<string, string>> => {
  const results = await client.runSuiteQL({
    select: 'id, name',
    from: tableName,
    where: `id IN (${internalIds.join(', ')})`,
    orderBy: 'id',
  })
  if (results === undefined) {
    log.warn('failed quering internal id to name mapping in table %s', tableName)
    return {}
  }
  const validResults = results.flatMap(res => {
    const { id, name } = res
    if (typeof id === 'string' && id !== '' && typeof name === 'string' && name !== '') {
      return { id, name }
    }
    log.warn('ignoring invalid result from table %s: %o', tableName, res)
    return []
  })
  return Object.fromEntries(validResults.map(({ id, name }) => [id, name]))
}

const addMissingReferenceNames = async (
  instances: InstanceElement[],
  params: ReferenceNameParams,
  client: NetsuiteClient,
): Promise<void> => {
  const referencesWithoutName = instances
    .filter(instance => instance.elemID.typeName === params.typeName)
    .flatMap(instance => makeArray(instance.value[params.fieldName]))
    .filter(ref => _.isPlainObject(ref) && ref[INTERNAL_ID] !== undefined && ref[NAME_FIELD] === undefined)

  if (referencesWithoutName.length === 0) {
    return
  }
  const internalIdsToQuery: string[] = _.uniq(referencesWithoutName.map(ref => ref[INTERNAL_ID]))
  const internalIdToName = await querySuiteQLTable(client, params.suiteQLTableName, internalIdsToQuery)
  referencesWithoutName.forEach(ref => {
    const name = internalIdToName[ref[INTERNAL_ID]]
    if (name !== undefined) {
      ref[NAME_FIELD] = name
    } else {
      log.warn(
        'could not find name of reference with internal id %s in table %s',
        ref[INTERNAL_ID],
        params.suiteQLTableName,
      )
    }
  })
}

const filterCreator: RemoteFilterCreator = ({ client }) => ({
  name: 'dataInstancesReferenceNames',
  remote: true,
  onFetch: async elements => {
    const instances = elements.filter(isInstanceElement)
    await Promise.all(REFERENCE_NAMES_PARAMS.map(params => addMissingReferenceNames(instances, params, client)))
  },
})

export default filterCreator
