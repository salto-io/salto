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
  Element, isInstanceElement,
} from '@salto-io/adapter-api'
import {
  MapKeyFunc, mapKeysRecursive,
} from '@salto-io/adapter-utils'
import { FilterWith } from '../filter'
import { XML_ATTRIBUTE_PREFIX } from '../constants'
import { metadataType } from '../transformers/transformer'
import { metadataTypesWithAttributes } from '../transformers/xml_transformer'


const removeAttributePrefixFunc: MapKeyFunc = ({ key }) => key.replace(XML_ATTRIBUTE_PREFIX, '')

const filterCreator = (): FilterWith<'onFetch'> => ({
  /**
   * Upon fetch remove the XML_ATTRIBUTE_PREFIX from the instance.value keys so it'll match the type
   */
  onFetch: async (elements: Element[]): Promise<void> => {
    elements
      .filter(isInstanceElement)
      .filter(inst => metadataTypesWithAttributes.includes(metadataType(inst)))
      .forEach(inst => {
        inst.value = mapKeysRecursive(inst.value, removeAttributePrefixFunc, inst.elemID)
      })
  },
})

export default filterCreator
