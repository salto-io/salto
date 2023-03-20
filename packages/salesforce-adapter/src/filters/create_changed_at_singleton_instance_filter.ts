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
  ObjectType,
  Values,
} from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
import { FilterWith } from '../filter'
import { apiName, isMetadataInstanceElement } from '../transformers/transformer'
import { CHANGED_AT_SINGLETON, INSTANCE_FULL_NAME_FIELD, SALESFORCE } from '../constants'

const { groupByAsync, awu } = collections.asynciterable
const { isDefined } = values


const createChangedAtSingletonInstanceValues = (metadataInstancesByType: Record<string, InstanceElement[]>): Values => {
  const instanceValues: Values = {}
  Object.entries(metadataInstancesByType).forEach(([metadataType, instances]) => {
    instanceValues[metadataType] = {}
    instances.forEach(instance => {
      const instanceName = instance.value[INSTANCE_FULL_NAME_FIELD]
      instanceValues[metadataType][instanceName] = instance.value[CORE_ANNOTATIONS.CHANGED_AT]
    })
  })
  return instanceValues
}

const filterCreator = (): FilterWith<'onFetch'> => ({
  name: 'createChangedAtSingletonInstanceFilter',
  onFetch: async (elements: Element[]) => {
    const metadataInstancesByType = await groupByAsync(
      await awu(elements)
        .filter(isInstanceElement)
        .filter(isMetadataInstanceElement)
        .filter(instance => isDefined(instance.annotations[CORE_ANNOTATIONS.CHANGED_AT]))
        .toArray(),
      async instance => apiName(await instance.getType())
    )
    const changedAtInstance = new InstanceElement(
      CHANGED_AT_SINGLETON,
      new ObjectType({
        elemID: new ElemID(SALESFORCE, CHANGED_AT_SINGLETON),
        isSettings: true,
        annotations: {
          [CORE_ANNOTATIONS.HIDDEN]: true,
          [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
        },
      }),
      createChangedAtSingletonInstanceValues(metadataInstancesByType),
    )
    elements.push(changedAtInstance)
  },
})

export default filterCreator
