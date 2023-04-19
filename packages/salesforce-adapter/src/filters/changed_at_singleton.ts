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
  InstanceElement,
  isInstanceElement,
  Values,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { FilterWith, LocalFilterCreator } from '../filter'
import { isMetadataInstanceElement } from '../transformers/transformer'
import { ArtificialTypes, INSTANCE_FULL_NAME_FIELD } from '../constants'
import { getChangedAtSingleton, safeApiName } from './utils'

const { groupByAsync, awu } = collections.asynciterable


const createChangedAtSingletonInstanceValues = (metadataInstancesByType: Record<string, InstanceElement[]>): Values => {
  const instanceValues: Values = {}
  Object.entries(metadataInstancesByType).forEach(([metadataType, instances]) => {
    instanceValues[metadataType] = {}
    instances.forEach(instance => {
      const instanceName = instance.value[INSTANCE_FULL_NAME_FIELD]
      instanceValues[metadataType][instanceName] = instance.annotations[CORE_ANNOTATIONS.CHANGED_AT]
    })
  })
  return instanceValues
}

const filterCreator: LocalFilterCreator = ({ config }): FilterWith<'onFetch'> => ({
  name: 'changedAtSingletonFilter',
  onFetch: async (elements: Element[]) => {
    const metadataInstancesByType = await groupByAsync(
      await awu(elements)
        .filter(isInstanceElement)
        .filter(isMetadataInstanceElement)
        .filter(instance => _.isString(instance.annotations[CORE_ANNOTATIONS.CHANGED_AT]))
        .toArray(),
      async instance => await safeApiName(instance) ?? '_unsorted'
    )
    // None of the Elements were annotated with changedAt
    if (Object.values(metadataInstancesByType).flat().length === 0) {
      return
    }

    const currentValues = createChangedAtSingletonInstanceValues(metadataInstancesByType)
    const valuesFromElementsSource = (await getChangedAtSingleton(config.elementsSource))?.value ?? {}
    const changedAtInstance = new InstanceElement(
      ElemID.CONFIG_NAME,
      ArtificialTypes.ChangedAtSingleton,
      _.defaultsDeep(currentValues, valuesFromElementsSource),
    )
    elements.push(changedAtInstance)
  },
})

export default filterCreator
