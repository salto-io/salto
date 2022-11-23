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
import { collections } from '@salto-io/lowerdash'
import { Element, ElemID, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { LocalFilterCreator } from '../filter'
import { SALESFORCE } from '../constants'

const { awu } = collections.asynciterable

type FieldIdentifier = {
  parentType: ElemID
  fieldName: string
}

const fieldsToConvert: Array<FieldIdentifier> = [
  {
    parentType: new ElemID(SALESFORCE, 'EntitlementTemplate'),
    fieldName: 'entitlementProcess',
  },
]

const convertField = async (
  instance: InstanceElement,
  fieldIdentifierMap: Record<string, FieldIdentifier[]>
): Promise<void> => {
  const instanceElemId = (await instance.getType()).elemID.getFullName()
  const fieldDescriptors = fieldIdentifierMap[instanceElemId]
  if (!fieldDescriptors) {
    return
  }
  fieldDescriptors.filter(fieldDesc => fieldDesc.fieldName in instance.value).forEach(fieldDesc => {
    instance.value[fieldDesc.fieldName] = instance.value[fieldDesc.fieldName].toLocaleLowerCase()
  })
}

/**
 */
export const makeFilter = (): LocalFilterCreator => () => ({
  /**
   * Upon fetch, mark all list fields as list fields in all fetched types
   *
   * @param elements the already fetched elements
   */
  onFetch: async (elements: Element[]) => {
    const typesOfInterest = await awu(fieldsToConvert).groupBy(fieldDesc => fieldDesc.parentType.getFullName())

    const instancesToConvert = await awu(elements)
      .filter(isInstanceElement)
      .filter(async inst => (await inst.getType()).elemID.getFullName() in typesOfInterest)
      .toArray()
    await awu(instancesToConvert).forEach(instance => convertField(instance, typesOfInterest))
  },
})

export default makeFilter()
