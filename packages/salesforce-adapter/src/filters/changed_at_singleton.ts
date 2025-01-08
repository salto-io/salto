/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { CORE_ANNOTATIONS, Element, ElemID, InstanceElement, Values } from '@salto-io/adapter-api'
import _ from 'lodash'
import { FilterCreator } from '../filter'
import { ArtificialTypes, DATA_INSTANCES_CHANGED_AT_MAGIC } from '../constants'
import {
  apiNameSync,
  getChangedAtSingletonInstance,
  isMetadataInstanceElementSync,
  isInstanceOfCustomObjectSync,
  metadataTypeSync,
} from './utils'
import { MetadataInstanceElement } from '../transformers/transformer'
import { LastChangeDateOfTypesWithNestedInstances } from '../types'

const createCurrentChangedAtSingletonValues = (
  lastChangeDateOfTypesWithNestedInstances: LastChangeDateOfTypesWithNestedInstances | {},
  metadataInstancesByType: Record<string, MetadataInstanceElement[]>,
): Values => {
  const instanceValues: Values = {}
  Object.entries(metadataInstancesByType).forEach(([metadataType, elements]) => {
    instanceValues[metadataType] = {}
    elements.forEach(element => {
      instanceValues[metadataType][apiNameSync(element) ?? ''] = element.annotations[CORE_ANNOTATIONS.CHANGED_AT]
    })
  })
  return _.defaultsDeep(lastChangeDateOfTypesWithNestedInstances, instanceValues)
}

const createEmptyChangedAtSingletonInstance = async (): Promise<InstanceElement> =>
  new InstanceElement(ElemID.CONFIG_NAME, ArtificialTypes.ChangedAtSingleton)

const dateStringOfMostRecentlyChangedInstance = (instances: InstanceElement[]): string | undefined =>
  _(instances)
    .map(instance => instance.annotations[CORE_ANNOTATIONS.CHANGED_AT])
    .filter(_.isString)
    .maxBy(changedAt => new Date(changedAt).getTime())

const filterCreator: FilterCreator = ({ config }) => ({
  name: 'changedAtSingletonFilter',
  onFetch: async (elements: Element[]) => {
    const { lastChangeDateOfTypesWithNestedInstances = {} } = config
    const instancesByType = _.groupBy(
      elements
        .filter(isMetadataInstanceElementSync)
        .filter(element => element.annotations[CORE_ANNOTATIONS.CHANGED_AT]),
      metadataTypeSync,
    )
    const changedAtInstance =
      (await getChangedAtSingletonInstance(config.elementsSource)) ?? (await createEmptyChangedAtSingletonInstance())
    elements.push(changedAtInstance)
    // None of the Elements were annotated with changedAt
    if (Object.values(instancesByType).flat().length === 0) {
      return
    }
    changedAtInstance.value = Object.fromEntries(
      Object.entries(
        _.defaultsDeep(
          createCurrentChangedAtSingletonValues(lastChangeDateOfTypesWithNestedInstances, instancesByType),
          changedAtInstance.value,
        ),
      ).filter(([, value]) => value !== undefined),
    )

    const instanceLastChangedByCustomObjectType = _(elements)
      .filter(isInstanceOfCustomObjectSync)
      .groupBy(instance => apiNameSync(instance.getTypeSync()))
      .mapValues(dateStringOfMostRecentlyChangedInstance)

    instanceLastChangedByCustomObjectType
      .entries()
      .filter(([, mostRecentChangedAt]) => mostRecentChangedAt !== undefined)
      .forEach(([typeName, mostRecentChangedAt]) => {
        _.set(changedAtInstance.value, [DATA_INSTANCES_CHANGED_AT_MAGIC, typeName], mostRecentChangedAt)
      })
  },
})

export default filterCreator
