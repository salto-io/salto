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
import {
  Element, isInstanceElement, InstanceElement, getChangeElement, Change, isObjectType,
  Field,
} from '@salto-io/adapter-api'
import { transformValues, TransformFunc } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { FilterCreator } from '../filter'
import { apiName, metadataType } from '../transformers/transformer'
import { generateReferenceResolverFinder } from '../transformers/reference_mapping'
import SalesforceClient from '../client/client'
import { getIdsForType } from './add_missing_ids'
import { getInternalId } from './utils'
import { CUSTOM_FIELD } from '../constants'

const { awu } = collections.asynciterable

const log = logger(module)

/*
The keys represent metadataTypes of the instances to change.
The values represent api names of other instances, that the first instances' fields refer to.
*/
const metadataTypeToInstanceName: Record<string, string> = {
  ForecastingSettings: 'Opportunity',
}

const fieldSelectMapping = [
  { src: { field: 'field', parentTypes: ['OpportunityListFieldsSelectedSettings', 'OpportunityListFieldsUnselectedSettings', 'OpportunityListFieldsLabelMapping'] } },
]

/*
 * converts an 18-char internalId to a 15-char internalId.
 */
const toShortId = (longId: string): string => (longId.slice(0, -3))

const getApiNameToIdLookup = async (client: SalesforceClient): Promise<Record<string, string>> => (
  _.mapValues(await getIdsForType(client, CUSTOM_FIELD), toShortId)
)

const shouldReplace = async (field: Field): Promise<boolean> => {
  const resolverFinder = generateReferenceResolverFinder(fieldSelectMapping)
  return (await resolverFinder(field)).length > 0
}

const replaceInstanceValues = async (instance: InstanceElement,
  nameLookup: Record<string, string>): Promise<void> => {
  const transformFunc: TransformFunc = async ({ value, field }) => {
    if (_.isUndefined(field) || !(await shouldReplace(field))) {
      return value
    }

    // if we can't find an item in the lookup it's because
    // it's a standard field that doesn't need translation
    return _.isArray(value)
      ? value.map(s => nameLookup[s] ?? s)
      : (nameLookup[value] ?? value)
  }

  const values = instance.value
  instance.value = await transformValues(
    {
      values,
      type: await instance.getType(),
      transformFunc,
      strict: false,
    }
  ) ?? values
}

const replaceInstancesValues = async (
  elements: Element[],
  nameLookUp: Record<string, string>
): Promise<void> => {
  await awu(elements)
    .filter(isInstanceElement)
    .filter(async e => Object.keys(metadataTypeToInstanceName).includes(await metadataType(e)))
    .forEach(async e => {
      await replaceInstanceValues(e, nameLookUp)
      log.debug(`replaced values of instance ${await apiName(e)}`)
    })
}

const getIdToNameLookupFromAllElements = async (
  elements: Element[]
): Promise<Record<string, string>> => {
  const lookup: Record<string, string> = {}
  const fields = await awu(elements)
    .filter(isObjectType)
    .filter(async e => Object.values(metadataTypeToInstanceName).includes(await apiName(e)))
    .flatMap(e => Object.values(e.fields))
    .toArray()

  Object.assign(lookup, ...await awu(fields).map(async field => {
    const id = getInternalId(field)
    return id === undefined ? {} : {
      [toShortId(id)]: await apiName(field),
    }
  }).toArray())
  return lookup
}

/**
 * Replace specific field values that are fetched as ids, to their names.
 */
const filter: FilterCreator = ({ client }) => ({
  onFetch: async (elements: Element[]) => {
    const idToApiNameLookUp = await getIdToNameLookupFromAllElements(elements)
    await replaceInstancesValues(elements, idToApiNameLookUp)
  },
  preDeploy: async (changes: ReadonlyArray<Change>): Promise<void> => {
    const apiNameToIdLookup = await getApiNameToIdLookup(client)
    await replaceInstancesValues(
      changes.map(getChangeElement),
      apiNameToIdLookup
    )
  },
  onDeploy: async changes => {
    const apiNameToIdLookup = await getApiNameToIdLookup(client)
    const idToApiNameLookUp = Object.fromEntries( // invert the lookup
      Object.entries(apiNameToIdLookup).map(([key, value]) => ([value, key]))
    )
    await replaceInstancesValues(
      changes.map(getChangeElement),
      idToApiNameLookUp
    )
    return []
  },
})

export default filter
