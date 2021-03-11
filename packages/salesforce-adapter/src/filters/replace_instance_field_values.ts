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
  Element, isInstanceElement, InstanceElement, getChangeElement, Change, Field, ObjectType,
  ReadOnlyElementsSource,
} from '@salto-io/adapter-api'
import { transformValues, TransformFunc } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { collections, multiIndex } from '@salto-io/lowerdash'
import { FilterCreator } from '../filter'
import { apiName, metadataType, isCustomObject } from '../transformers/transformer'
import { generateReferenceResolverFinder } from '../transformers/reference_mapping'
import { getInternalId, hasInternalId, buildElementsSourceForFetch } from './utils'

const log = logger(module)
const { flatMapAsync, filterAsync } = collections.asynciterable

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

type GetRelevantFieldMappingParams = {
  elementsSource: ReadOnlyElementsSource
  key: (field: Field) => [string]
  value: (field: Field) => string
}
const getRelevantFieldMapping = async (
  { elementsSource, key, value }: GetRelevantFieldMappingParams
): Promise<multiIndex.Index<[string], string>> => {
  const isReferencedCustomObject = (elem: Element): elem is ObjectType => (
    isCustomObject(elem)
    && Object.values(metadataTypeToInstanceName).includes(apiName(elem))
  )

  return multiIndex.keyByAsync({
    iter: flatMapAsync(
      filterAsync(await elementsSource.getAll(), isReferencedCustomObject),
      obj => Object.values(obj.fields)
    ),
    filter: hasInternalId,
    key,
    map: value,
  })
}

const shouldReplace = (field: Field): boolean => {
  const resolverFinder = generateReferenceResolverFinder(fieldSelectMapping)
  return resolverFinder(field).length > 0
}

const replaceInstanceValues = (
  instance: InstanceElement,
  nameLookup: multiIndex.Index<[string], string>
): void => {
  const transformFunc: TransformFunc = ({ value, field }) => {
    if (_.isUndefined(field) || !shouldReplace(field)) {
      return value
    }

    // if we can't find an item in the lookup it's because
    // it's a standard field that doesn't need translation
    return _.isArray(value)
      ? value.map(s => nameLookup.get(s) ?? s)
      : (nameLookup.get(value) ?? value)
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

const replaceInstancesValues = (
  elements: Element[],
  nameLookUp: multiIndex.Index<[string], string>
): void => {
  elements
    .filter(isInstanceElement)
    .filter(e => Object.keys(metadataTypeToInstanceName).includes(metadataType(e)))
    .forEach(e => {
      replaceInstanceValues(e, nameLookUp)
      log.debug(`replaced values of instance ${apiName(e)}`)
    })
}

/**
 * Replace specific field values that are fetched as ids, to their names.
 */
const filter: FilterCreator = ({ config }) => ({
  onFetch: async (elements: Element[]) => {
    const referenceElements = buildElementsSourceForFetch(elements, config)
    const idToApiNameLookUp = await getRelevantFieldMapping({
      elementsSource: referenceElements,
      key: field => [toShortId(getInternalId(field))],
      value: apiName,
    })
    replaceInstancesValues(elements, idToApiNameLookUp)
  },
  preDeploy: async (changes: ReadonlyArray<Change>): Promise<void> => {
    const apiNameToIdLookup = await getRelevantFieldMapping({
      elementsSource: config.elementsSource,
      key: field => [apiName(field)],
      value: field => toShortId(getInternalId(field)),
    })
    replaceInstancesValues(
      changes.map(getChangeElement),
      apiNameToIdLookup
    )
  },
  onDeploy: async changes => {
    const idToApiNameLookUp = await getRelevantFieldMapping({
      elementsSource: config.elementsSource,
      key: field => [toShortId(getInternalId(field))],
      value: apiName,
    })
    replaceInstancesValues(
      changes.map(getChangeElement),
      idToApiNameLookUp
    )
    return []
  },
})

export default filter
