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
import _, { isArray } from 'lodash'
import {
  Element, InstanceElement, isInstanceElement, isReferenceExpression,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { DYNAMIC_CONTENT_ITEM_VARIANT_TYPE_NAME } from './dynamic_content'
import { GROUP_TYPE_NAME, MACRO_TYPE_NAME } from '../constants'

const log = logger(module)


const orderDynamicContentItems = (instances: InstanceElement[]): void => {
  const dynamicContentItemInstances = instances
    .filter(e => e.refType.elemID.name === 'dynamic_content_item')

  const dynamicContentItemVariantInstancesById = _.keyBy(
    instances.filter(e => e.refType.elemID.name === DYNAMIC_CONTENT_ITEM_VARIANT_TYPE_NAME),
    inst => inst.elemID.getFullName()
  )

  dynamicContentItemInstances.forEach(inst => {
    const { variants } = inst.value
    if (Array.isArray(variants) && variants.every(variant => {
      const variantId = isReferenceExpression(variant) ? variant.elemID?.getFullName() : undefined
      const variantInstance = variantId !== undefined ? dynamicContentItemVariantInstancesById[variantId] : undefined
      return (variantInstance !== undefined)
        && isReferenceExpression(variantInstance.value.locale_id)
        && isInstanceElement(variantInstance.value.locale_id.value)
    })
    ) {
      inst.value.variants = _.sortBy(
        inst.value.variants,
        // at most one variant is allowed per locale
        variant =>
          ([dynamicContentItemVariantInstancesById[variant.elemID.getFullName()].value.locale_id.value.value?.locale])
      )
    }
    log.error(`could not sort variants for ${inst.elemID.getFullName()}`)
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

const orderMacros = (instances: InstanceElement[]): void => {
  const macroInstances = instances
    .filter(e => e.refType.elemID.name === MACRO_TYPE_NAME)
  const groupInstancesById = _.keyBy(
    instances.filter(e => e.refType.elemID.name === GROUP_TYPE_NAME),
    inst => inst.elemID.getFullName()
  )
  macroInstances.forEach(macro => {
    const ids = macro.value.restriction?.ids
    if (isArray(ids) && ids.every(
      id => isReferenceExpression(id) && (groupInstancesById[id.elemID.getFullName()] !== undefined)
      && (groupInstancesById[id.elemID.getFullName()].value.name !== undefined)
    )) {
      macro.value.restriction.ids = _.sortBy(
        macro.value.restriction.ids,
        // at most one variant is allowed per locale
        id => ([groupInstancesById[id.elemID.getFullName()].value.name])
      )
    }
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
    orderMacros(instances)
  },
})

export default filterCreator
