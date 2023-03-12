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
import _, { isArray, isEmpty, isString } from 'lodash'
import {
  Element, InstanceElement, isInstanceElement, isReferenceExpression, ReferenceExpression,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { DYNAMIC_CONTENT_ITEM_VARIANT_TYPE_NAME } from './dynamic_content'
import {
  GROUP_TYPE_NAME,
  MACRO_TYPE_NAME,
  TICKET_FIELD_CUSTOM_FIELD_OPTION,
  TICKET_FIELD_TYPE_NAME,
  TICKET_FORM_TYPE_NAME,
} from '../constants'

const log = logger(module)

const getInstanceById = (type: string, instances: InstanceElement[]): Record<string, InstanceElement> => _.keyBy(
  instances.filter(e => e.refType.elemID.name === type),
  inst => inst.elemID.getFullName()
)

const orderDynamicContentItems = (instances: InstanceElement[]): void => {
  const dynamicContentItemInstances = instances
    .filter(e => e.refType.elemID.name === 'dynamic_content_item')

  const dynamicContentItemVariantInstancesById = getInstanceById(DYNAMIC_CONTENT_ITEM_VARIANT_TYPE_NAME, instances)

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
  const macroInstances = instances.filter(e => e.refType.elemID.name === MACRO_TYPE_NAME)
  const groupInstancesById = getInstanceById(GROUP_TYPE_NAME, instances)
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

const sortConditions = (
  formInstances: InstanceElement[],
  conditionType: string,
  customFieldById: Record<string, InstanceElement>
)
  : void => {
  formInstances.forEach(form => {
    const conditions = form.value[conditionType]
    if (isArray(conditions) && conditions.every(condition => (
      isReferenceExpression(condition.value)
        && (customFieldById[condition.value.elemID.getFullName()] !== undefined)
        && (customFieldById[condition.value.elemID.getFullName()].value.value !== undefined)
    )
      || (isString(condition.value)))) {
      form.value[conditionType] = _.sortBy(
        form.value[conditionType],
        // at most one variant is allowed per locale
        condition => (isString(condition.value)
          ? condition.value
          : [customFieldById[condition.value.elemID.getFullName()].value.value])
      )
    }
  })
}

const sortChildFields = (
  formInstances: InstanceElement[],
  ticketFieldById: Record<string, InstanceElement>
): void => {
  formInstances.forEach(form => {
    const conditions = (form.value.agent_conditions ?? []).concat(form.value.end_user_conditions ?? [])
    // eslint-disable-next-line camelcase
    conditions.forEach((condition: {child_fields: {id: ReferenceExpression}[]}) => {
      if (isArray(condition.child_fields) && condition.child_fields.every(field =>
        isReferenceExpression(field.id)
          && (ticketFieldById[field.id.elemID.getFullName()] !== undefined)
          && (ticketFieldById[field.id.elemID.getFullName()].value.raw_title !== undefined))) {
        condition.child_fields = _.sortBy(
          condition.child_fields,
          // at most one variant is allowed per locale
          field => ([ticketFieldById[field.id.elemID.getFullName()].value.raw_title])
        )
      }
    })
  })
}

const orderFormCondition = (instances: InstanceElement[]): void => {
  const formInstances = instances
    .filter(e => e.refType.elemID.name === TICKET_FORM_TYPE_NAME)
  const formAgentInstances = formInstances
    .filter(form => form.value.agent_conditions !== undefined && !isEmpty(form.value.agent_conditions))
  const formUserInstances = formInstances
    .filter(form => form.value.end_user_conditions !== undefined && !isEmpty(form.value.end_user_conditions))

  const customFieldById = getInstanceById(TICKET_FIELD_CUSTOM_FIELD_OPTION, instances)
  const ticketFieldById = getInstanceById(TICKET_FIELD_TYPE_NAME, instances)

  sortConditions(formAgentInstances, 'agent_conditions', customFieldById)
  sortConditions(formUserInstances, 'end_user_conditions', customFieldById)
  sortChildFields(formInstances, ticketFieldById)
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
    orderFormCondition(instances)
  },
})

export default filterCreator
