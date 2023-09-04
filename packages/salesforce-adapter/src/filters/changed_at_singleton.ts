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
import {
  CORE_ANNOTATIONS,
  Element,
  ElemID,
  InstanceElement, ObjectType,
  ReadOnlyElementsSource,
  Values,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { LocalFilterCreator } from '../filter'
import { ArtificialTypes, CUSTOM_OBJECT, INSTANCE_FULL_NAME_FIELD } from '../constants'
import { apiNameSync, getChangedAtSingleton, isCustomObjectSync, isMetadataInstanceElementSync } from './utils'

const createChangedAtSingletonInstanceValues = (
  metadataInstancesByType: Record<string, InstanceElement[]>,
  customObjectTypeByName: Record<string, ObjectType>,
) => {
  const instanceValues: Values = {}
  Object.entries(metadataInstancesByType).forEach(([metadataType, instances]) => {
    instanceValues[metadataType] = {}
    instances.forEach(instance => {
      const instanceName = instance.value[INSTANCE_FULL_NAME_FIELD]
      instanceValues[metadataType][instanceName] = instance.annotations[CORE_ANNOTATIONS.CHANGED_AT]
    })
  })
  instanceValues[CUSTOM_OBJECT] = _.mapValues(
    customObjectTypeByName,
    objectType => objectType.annotations[CORE_ANNOTATIONS.CHANGED_AT]
  )
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

const filterCreator: LocalFilterCreator = ({ config }) => ({
  name: 'changedAtSingletonFilter',
  onFetch: async (elements: Element[]) => {
    const metadataInstancesByType = _.groupBy(
      elements
        .filter(isMetadataInstanceElementSync)
        .filter(instance => _.isString(instance.annotations[CORE_ANNOTATIONS.CHANGED_AT])),
      async instance => apiNameSync(instance.getTypeSync())
    )
    const changedAtInstance = await getChangedAtSingletonInstance(config.elementsSource)
    elements.push(changedAtInstance)
    // None of the Elements were annotated with changedAt
    if (Object.values(metadataInstancesByType).flat().length === 0) {
      return
    }
    const customObjectTypeByName: Record<string, ObjectType> = _.keyBy(
      elements.filter(isCustomObjectSync),
      e => apiNameSync(e) ?? '',
    )
    changedAtInstance.value = _.defaultsDeep(
      createChangedAtSingletonInstanceValues(metadataInstancesByType, customObjectTypeByName),
      changedAtInstance.value,
    )
  },
})

export default filterCreator
