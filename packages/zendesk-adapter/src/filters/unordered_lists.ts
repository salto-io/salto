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
import _ from 'lodash'
import {
  Element, InstanceElement, isInstanceElement, isReferenceExpression,
} from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'


const orderDynamicContentItems = (instances: InstanceElement[]): void => {
  const dynamicContentItemInstances = instances
    .filter(e => e.refType.elemID.name === 'dynamic_content_item')

  dynamicContentItemInstances.forEach(inst => {
    if (Array.isArray(inst.value.variants) && inst.value.variants.every(variant =>
      isReferenceExpression(variant.locale_id) && isInstanceElement(variant.locale_id.value))
    ) {
      inst.value.variants = _.sortBy(
        inst.value.variants,
        // at most one variant is allowed per locale
        variant => ([variant.locale_id.value.value?.locale])
      )
    }
  })
}

const orderTriggerDefinitions = (instances: InstanceElement[]): void => {
  const triggerDefinitionsInstances = instances
    .filter(e => e.refType.elemID.name === 'trigger_definition')

  triggerDefinitionsInstances.forEach(inst => {
    const fieldsToOrder = ['actions', 'conditions_all', 'conditions_any']
    fieldsToOrder.forEach(fieldName => {
      if (Array.isArray(inst.value[fieldName])) {
        inst.value[fieldName] = _.sortBy(
          inst.value[fieldName],
          ['title', 'type'],
        )
      }
    })
  })
}

/**
 * Sort lists whose order changes between fetches, to avoid unneeded noise.
 */
const filterCreator: FilterCreator = () => ({
  name: 'unorderedListsFilter',
  onFetch: async (elements: Element[]): Promise<void> => {
    const instances = elements.filter(isInstanceElement)
    orderDynamicContentItems(instances)
    orderTriggerDefinitions(instances)
  },
})

export default filterCreator
