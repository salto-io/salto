/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { RemoteFilterCreator } from '../filter'
import { apiName } from '../transformers/transformer'
import { isInstanceOfType } from './utils'
import { SalesforceRecord } from '../client/types'

const { awu, keyByAsync } = collections.asynciterable
const log = logger(module)

type EnrichmentDef = {
  sourceType: string
  targetType: string
  instanceLookup: (sfRecord: SalesforceRecord, elements: Record<string, InstanceElement>) => InstanceElement
  fields: {
    source: string
    target: string
  }[]
}

const enrichmentDefs: EnrichmentDef[] = [
  {
    sourceType: 'SlaProcess',
    targetType: 'EntitlementProcess',
    instanceLookup: (sfRecord, elements) => elements[sfRecord.NameNorm],
    fields: [
      {
        source: 'Name',
        target: 'name',
      },
    ],
  },
]

const buildQueryString = (type: string, fields: string[]): string => (
  `SELECT ${fields.join()} FROM ${type}`
)

/**
 * Enrichment of standard objects.
 * Some fields are not available via the usual 'metadata describe' API and must be fetched via the query API.
 */
const filterCreator: RemoteFilterCreator = ({ client }) => ({
  onFetch: async elements => {
    const saltoTypesOfInterest = enrichmentDefs.map(def => def.targetType)
    const instancesToEnrich = await keyByAsync(
      awu(elements).filter(isInstanceElement).filter(isInstanceOfType(...saltoTypesOfInterest)),
      instance => apiName(instance),
    )
    if (_.isEmpty(instancesToEnrich)) {
      // Not fetching instances of any types we care about. Bail out.
      return
    }

    await awu(enrichmentDefs)
      .forEach(async def => {
        const queryString = buildQueryString(def.sourceType, def.fields.map(f => f.source))
        await awu(await client.queryAll(queryString))
          .flat()
          .forEach(sfRecord => {
            def.fields.forEach(({ source, target }) => {
              const targetInstance = def.instanceLookup(sfRecord, instancesToEnrich)
              if (!targetInstance) {
                log.warn(`No matching Salto element for Salesforce record ${sfRecord}`)
                return
              }
              targetInstance.value[target] = sfRecord[source]
            })
          })
      })
  },
})

export default filterCreator
