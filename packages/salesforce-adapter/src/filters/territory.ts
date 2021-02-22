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
import { Element } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { isInstanceOfType } from './utils'
import { isMetadataObjectType, metadataType } from '../transformers/transformer'
import { TERRITORY2_TYPE, TERRITORY2_MODEL_TYPE } from '../constants'

const log = logger(module)

const removeCustomFieldsFromType = (elements: Element[], typeName: string): void => {
  const type = elements
    .filter(isMetadataObjectType)
    .find(elem => metadataType(elem) === typeName)
  if (type === undefined) {
    log.debug('Type %s not found', typeName)
    return
  }
  delete type.fields.customFields

  const instances = elements.filter(isInstanceOfType(typeName))
  instances.forEach(inst => {
    delete inst.value.customFields
  })
}

const filterCreator: FilterCreator = () => ({
  onFetch: async elements => {
    // Remove custom field definitions from territory and territory model
    removeCustomFieldsFromType(elements, TERRITORY2_TYPE)
    removeCustomFieldsFromType(elements, TERRITORY2_MODEL_TYPE)
  },
})

export default filterCreator
