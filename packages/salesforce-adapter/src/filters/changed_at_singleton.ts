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
import {
  CORE_ANNOTATIONS,
  Element,
  ElemID,
  InstanceElement,
  ReadOnlyElementsSource,
  Values,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { LocalFilterCreator } from '../filter'
import {
  ArtificialTypes,
  DATA_INSTANCES_CHANGED_AT_MAGIC,
} from '../constants'
import {
  apiNameSync,
  getChangedAtSingleton,
  isCustomObjectSync,
  isMetadataInstanceElementSync,
  isInstanceOfCustomObjectSync,
  metadataTypeSync,
} from './utils'

const createChangedAtSingletonInstanceValues = (metadataInstancesByType: Record<string, Element[]>): Values => {
  const instanceValues: Values = {}
  Object.entries(metadataInstancesByType).forEach(([metadataType, elements]) => {
    instanceValues[metadataType] = {}
    elements.forEach(element => {
      instanceValues[metadataType][apiNameSync(element) ?? ''] = element.annotations[CORE_ANNOTATIONS.CHANGED_AT]
    })
  })
  return instanceValues
}

const createEmptyChangedAtSingletonInstance = async (): Promise<InstanceElement> => (
  new InstanceElement(
    ElemID.CONFIG_NAME,
    ArtificialTypes.ChangedAtSingleton,
  )
)

const getChangedAtSingletonInstance = async (
  elementsSource: ReadOnlyElementsSource | undefined
): Promise<InstanceElement> => {
  const changedAtSingleton = elementsSource !== undefined
    ? await getChangedAtSingleton(elementsSource)
    : undefined
  return changedAtSingleton ?? createEmptyChangedAtSingletonInstance()
}

const dateStringOfMostRecentlyChangedInstance = (instances: InstanceElement[]): string => (
  _(instances)
    .map(instance => instance.annotations[CORE_ANNOTATIONS.CHANGED_AT])
    .filter(changedAt => changedAt !== undefined)
    .maxBy((changedAt: string) => new Date(changedAt).getTime())
)

const filterCreator: LocalFilterCreator = ({ config }) => ({
  name: 'changedAtSingletonFilter',
  onFetch: async (elements: Element[]) => {
    const elementsByType = _.groupBy(
      elements
        .filter(element => isMetadataInstanceElementSync(element) || isCustomObjectSync(element))
        .filter(element => element.annotations[CORE_ANNOTATIONS.CHANGED_AT]),
      metadataTypeSync
    )
    const changedAtInstance = await getChangedAtSingletonInstance(config.elementsSource)
    elements.push(changedAtInstance)
    // None of the Elements were annotated with changedAt
    if (Object.values(elementsByType).flat().length === 0) {
      return
    }
    changedAtInstance.value = _.defaultsDeep(
      createChangedAtSingletonInstanceValues(elementsByType),
      changedAtInstance.value,
    )

    const instanceLastChangedByCustomObjectType = _(elements)
      .filter(isInstanceOfCustomObjectSync)
      .groupBy(instance => apiNameSync(instance.getTypeSync()))
      .mapValues(dateStringOfMostRecentlyChangedInstance)

    instanceLastChangedByCustomObjectType
      .entries()
      .forEach(([typeName, dateString]) => {
        _.set(changedAtInstance.value, [DATA_INSTANCES_CHANGED_AT_MAGIC, typeName], dateString)
      })
  },
})

export default filterCreator
