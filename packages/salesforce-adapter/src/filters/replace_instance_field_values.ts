/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { FilterCreator } from '../filter'
import { apiName, metadataType } from '../transformers/transformer'
import { generateReferenceResolverFinder } from '../transformers/reference_mapping'
import SalesforceClient from '../client/client'
import { getIdsForType } from './add_missing_ids'
import { getInternalId } from './utils'
import { CUSTOM_FIELD } from '../constants'

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

const shouldReplace = (field: Field): boolean => {
  const resolverFinder = generateReferenceResolverFinder(fieldSelectMapping)
  return resolverFinder(field).length > 0
}

const replaceInstanceValues = (instance: InstanceElement,
  nameLookup: Record<string, string>): void => {
  const transformFunc: TransformFunc = ({ value, field }) => {
    if (_.isUndefined(field) || !shouldReplace(field)) {
      return value
    }

    // if we can't find an item in the lookup it's because
    // it's a standard field that doesn't need translation
    return _.isArray(value)
      ? value.map(s => nameLookup[s] ?? s)
      : (nameLookup[value] ?? value)
  }

  const values = instance.value
  instance.value = transformValues(
    {
      values,
      type: instance.type,
      transformFunc,
      strict: false,
    }
  ) ?? values
}

const replaceInstancesValues = (elements: Element[], nameLookUp: Record<string, string>): void => {
  elements
    .filter(isInstanceElement)
    .filter(e => Object.keys(metadataTypeToInstanceName).includes(metadataType(e)))
    .forEach(e => {
      replaceInstanceValues(e, nameLookUp)
      log.debug(`replaced values of instance ${apiName(e)}`)
    })
}

const getIdToNameLookupFromAllElements = (elements: Element[]): Record<string, string> => {
  const lookup: Record<string, string> = {}
  const fields = elements
    .filter(isObjectType)
    .filter(e => Object.values(metadataTypeToInstanceName).includes(apiName(e)))
    .flatMap(e => Object.values(e.fields))

  Object.assign(lookup, ...fields.map(field => {
    const id = getInternalId(field)
    return id === undefined ? {} : {
      [toShortId(id)]: apiName(field),
    }
  }))
  return lookup
}

/**
 * Replace specific field values that are fetched as ids, to their names.
 */
const filter: FilterCreator = ({ client }) => ({
  onFetch: async (elements: Element[]) => {
    const idToApiNameLookUp = getIdToNameLookupFromAllElements(elements)
    replaceInstancesValues(elements, idToApiNameLookUp)
  },
  preDeploy: async (changes: ReadonlyArray<Change>): Promise<void> => {
    const apiNameToIdLookup = await getApiNameToIdLookup(client)
    replaceInstancesValues(
      changes.map(getChangeElement),
      apiNameToIdLookup
    )
  },
  onDeploy: async changes => {
    const apiNameToIdLookup = await getApiNameToIdLookup(client)
    const idToApiNameLookUp = Object.fromEntries( // invert the lookup
      Object.entries(apiNameToIdLookup).map(([key, value]) => ([value, key]))
    )
    replaceInstancesValues(
      changes.map(getChangeElement),
      idToApiNameLookUp
    )
    return []
  },
})

export default filter
