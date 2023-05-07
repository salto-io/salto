/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { Element, isInstanceElement, InstanceElement, getChangeData, Change, Field, ReadOnlyElementsSource, isObjectType } from '@salto-io/adapter-api'
import { transformValues, TransformFunc } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { collections, multiIndex } from '@salto-io/lowerdash'
import { LocalFilterCreator } from '../filter'
import { apiName, metadataType, isCustomObject } from '../transformers/transformer'
import { generateReferenceResolverFinder } from '../transformers/reference_mapping'
import { getInternalId, hasInternalId, buildElementsSourceForFetch } from './utils'

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

type GetRelevantFieldMappingParams = {
  elementsSource: ReadOnlyElementsSource
  key: (field: Field) => [string] | Promise<[string]>
  value: (field: Field) => string | Promise<string>
}
const getRelevantFieldMapping = async (
  { elementsSource, key, value }: GetRelevantFieldMappingParams
): Promise<multiIndex.Index<[string], string>> => {
  const isReferencedCustomObject = async (elem: Element): Promise<boolean> => (
    await isCustomObject(elem)
    && Object.values(metadataTypeToInstanceName).includes(await apiName(elem))
  )

  return multiIndex.keyByAsync({
    iter: awu(await elementsSource.getAll())
      .filter(isObjectType)
      .filter(isReferencedCustomObject)
      .flatMap(obj => Object.values(obj.fields)),
    filter: hasInternalId,
    key,
    map: value,
  })
}

const shouldReplace = async (field: Field, instance: InstanceElement): Promise<boolean> => {
  const resolverFinder = generateReferenceResolverFinder(fieldSelectMapping)
  return (await resolverFinder(field, instance)).length > 0
}

const replaceInstanceValues = async (
  instance: InstanceElement,
  nameLookup: multiIndex.Index<[string], string>
): Promise<void> => {
  const transformFunc: TransformFunc = async ({ value, field }) => {
    if (_.isUndefined(field) || !(await shouldReplace(field, instance))) {
      return value
    }

    // if we can't find an item in the lookup it's because
    // it's a standard field that doesn't need translation
    return _.isArray(value)
      ? value.map(s => nameLookup.get(s) ?? s)
      : (nameLookup.get(value) ?? value)
  }

  const values = instance.value
  instance.value = await transformValues(
    {
      values,
      type: await instance.getType(),
      transformFunc,
      strict: false,
      allowEmpty: true,
    }
  ) ?? values
}

const replaceInstancesValues = async (
  elements: Element[],
  nameLookUp: multiIndex.Index<[string], string>
): Promise<void> => {
  await awu(elements)
    .filter(isInstanceElement)
    .filter(async e => Object.keys(metadataTypeToInstanceName).includes(await metadataType(e)))
    .forEach(async e => {
      await replaceInstanceValues(e, nameLookUp)
      log.debug(`replaced values of instance ${await apiName(e)}`)
    })
}

/**
 * Replace specific field values that are fetched as ids, to their names.
 */
const filter: LocalFilterCreator = ({ config }) => ({
  name: 'replaceFieldValuesFilter',
  onFetch: async (elements: Element[]) => {
    const referenceElements = buildElementsSourceForFetch(elements, config)
    const idToApiNameLookUp = await getRelevantFieldMapping({
      elementsSource: referenceElements,
      key: field => [toShortId(getInternalId(field))],
      value: async field => apiName(field),
    })
    await replaceInstancesValues(elements, idToApiNameLookUp)
  },
  preDeploy: async (changes: ReadonlyArray<Change>): Promise<void> => {
    const apiNameToIdLookup = await getRelevantFieldMapping({
      elementsSource: config.elementsSource,
      key: async field => [await apiName(field)],
      value: field => toShortId(getInternalId(field)),
    })
    await replaceInstancesValues(
      changes.map(getChangeData),
      apiNameToIdLookup
    )
  },
  onDeploy: async changes => {
    const idToApiNameLookUp = await getRelevantFieldMapping({
      elementsSource: config.elementsSource,
      key: field => [toShortId(getInternalId(field))],
      value: apiName,
    })
    await replaceInstancesValues(
      changes.map(getChangeData),
      idToApiNameLookUp
    )
  },
})

export default filter
