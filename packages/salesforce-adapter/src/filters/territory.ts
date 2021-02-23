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
import { Element, isInstanceElement } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { isMetadataObjectType, metadataType } from '../transformers/transformer'
import { TERRITORY2_TYPE, TERRITORY2_MODEL_TYPE } from '../constants'

const removeCustomFieldsFromTypes = (elements: Element[], typeNames: string[]): void => {
  const elementsOfTypes = elements.filter(elem => typeNames.includes(metadataType(elem)))
  elementsOfTypes
    .filter(isMetadataObjectType)
    .forEach(type => {
      delete type.fields.customFields
    })
  elementsOfTypes
    .filter(isInstanceElement)
    .forEach(inst => {
      delete inst.value.customFields
    })
}

const filterCreator: FilterCreator = () => ({
  onFetch: async elements => {
    // Territory2 and Territory2Model support custom fields - these are returned
    // in a CustomObject with the appropriate name and also in each instance of these types
    // We remove the fields from the instances to avoid duplication
    removeCustomFieldsFromTypes(elements, [TERRITORY2_TYPE, TERRITORY2_MODEL_TYPE])
  },
})

export default filterCreator
