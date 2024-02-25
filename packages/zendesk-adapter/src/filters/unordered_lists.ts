/*
 *                      Copyright 2024 Salto Labs Ltd.
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
  Element,
  InstanceElement,
  isInstanceElement,
  isReferenceExpression,
  ReferenceExpression,
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
  VIEW_TYPE_NAME,
} from '../constants'

const log = logger(module)

type ChildField = { id: ReferenceExpression }
// eslint-disable-next-line camelcase
type Condition = { child_fields: ChildField[]; value: ReferenceExpression | string }

const getInstanceByFullName = (type: string, instances: InstanceElement[]): Record<string, InstanceElement> =>
  _.keyBy(
    instances.filter(e => e.refType.elemID.name === type),
    inst => inst.elemID.getFullName(),
  )

const idValidVariants = (
  variants: unknown,
  dynamicContentItemVariantInstancesById: Record<string, InstanceElement>,
): variants is ReferenceExpression[] =>
  _.isArray(variants) &&
  variants.every(variant => {
    const variantInstance = isReferenceExpression(variant)
      ? dynamicContentItemVariantInstancesById[variant.elemID.getFullName()]
      : undefined
    return (
      variantInstance !== undefined &&
      isReferenceExpression(variantInstance.value.locale_id) &&
      isInstanceElement(variantInstance.value.locale_id.value)
    )
  })

const orderDynamicContentItems = (instances: InstanceElement[]): void => {
  const dynamicContentItemInstances = instances.filter(e => e.refType.elemID.name === 'dynamic_content_item')

  const dynamicContentItemVariantInstancesById = getInstanceByFullName(
    DYNAMIC_CONTENT_ITEM_VARIANT_TYPE_NAME,
    instances,
  )

  dynamicContentItemInstances.forEach(inst => {
    const { variants } = inst.value
    if (idValidVariants(variants, dynamicContentItemVariantInstancesById)) {
      inst.value.variants = _.sortBy(
        variants,
        // at most one variant is allowed per locale
        variant => [
          dynamicContentItemVariantInstancesById[variant.elemID.getFullName()].value.locale_id.value.value?.locale,
        ],
      )
    } else {
      log.warn(`could not sort variants for ${inst.elemID.getFullName()}`)
    }
  })
}

const orderTriggerDefinitions = (instances: InstanceElement[]): void => {
  const triggerDefinitionsInstances = instances.filter(e => e.refType.elemID.name === 'trigger_definition')

  triggerDefinitionsInstances.forEach(inst => {
    const fieldsToOrder = ['actions', 'conditions_all', 'conditions_any']
    fieldsToOrder.forEach(fieldName => {
      if (Array.isArray(inst.value[fieldName])) {
        inst.value[fieldName] = _.sortBy(inst.value[fieldName], ['title', 'type'])
      }
    })
  })
}

const isValidRestrictionIds = (
  ids: unknown,
  groupInstancesById: Record<string, InstanceElement>,
): ids is ReferenceExpression[] =>
  _.isArray(ids) &&
  ids.every(id => isReferenceExpression(id) && groupInstancesById[id.elemID.getFullName()]?.value.name !== undefined)

const orderMacroAndViewRestrictions = (instances: InstanceElement[]): void => {
  const relevantInstances = instances.filter(e => [MACRO_TYPE_NAME, VIEW_TYPE_NAME].includes(e.refType.elemID.name))
  const groupInstancesById = getInstanceByFullName(GROUP_TYPE_NAME, instances)
  relevantInstances.forEach(instance => {
    const ids = instance.value.restriction?.ids
    if (ids === undefined) {
      // the restriction does not have to be by ids
      return
    }
    if (isValidRestrictionIds(ids, groupInstancesById)) {
      instance.value.restriction.ids = _.sortBy(
        ids,
        // at most one variant is allowed per locale
        id => [groupInstancesById[id.elemID.getFullName()].value.name],
      )
    } else {
      log.warn(`could not sort ids for ${instance.elemID.getFullName()}`)
    }
  })
}

const isValidConditions = (
  conditions: unknown,
  customFieldById: Record<string, InstanceElement>,
): conditions is Condition[] =>
  _.isArray(conditions) &&
  conditions.every(
    condition =>
      (isReferenceExpression(condition.value) &&
        customFieldById[condition.value.elemID.getFullName()]?.value.value !== undefined) ||
      _.isString(condition.value) ||
      _.isBoolean(condition.value),
  )

const sortConditions = (
  formInstances: InstanceElement[],
  conditionType: string,
  customFieldById: Record<string, InstanceElement>,
): void => {
  formInstances.forEach(form => {
    const conditions = form.value[conditionType]
    if (conditions === undefined) {
      // there may not be any conditions
      return
    }
    if (isValidConditions(conditions, customFieldById)) {
      form.value[conditionType] = _.sortBy(conditions, condition =>
        _.isString(condition.value) || _.isBoolean(condition.value)
          ? condition.value
          : [customFieldById[condition.value.elemID.getFullName()].value.value],
      )
    } else {
      log.warn(`could not sort conditions for ${form.elemID.getFullName()}`)
    }
  })
}

const isValidChildFields = (
  condition: unknown,
  ticketFieldById: Record<string, InstanceElement>,
): condition is Condition => {
  if (!(_.isObject(condition) && 'child_fields' in condition)) {
    return false
  }
  const val = _.get(condition, 'child_fields')
  return (
    _.isArray(val) &&
    val.every(
      field =>
        isReferenceExpression(field.id) &&
        ticketFieldById[field.id.elemID.getFullName()]?.value.raw_title !== undefined,
    )
  )
}

const sortChildFields = (formInstances: InstanceElement[], ticketFieldById: Record<string, InstanceElement>): void => {
  formInstances.forEach(form => {
    const conditions = (form.value.agent_conditions ?? []).concat(form.value.end_user_conditions ?? [])
    // eslint-disable-next-line camelcase
    conditions.forEach((condition: Condition) => {
      if (isValidChildFields(condition, ticketFieldById)) {
        condition.child_fields = _.sortBy(
          condition.child_fields,
          // at most one variant is allowed per locale
          field => [ticketFieldById[field.id.elemID.getFullName()].value.raw_title],
        )
      } else {
        log.warn(`could not sort child fields for ${form.elemID.getFullName()}`)
      }
    })
  })
}

const orderFormCondition = (instances: InstanceElement[]): void => {
  const formInstances = instances.filter(e => e.refType.elemID.name === TICKET_FORM_TYPE_NAME)
  const formAgentInstances = formInstances.filter(form => !_.isEmpty(form.value.agent_conditions))
  const formUserInstances = formInstances.filter(form => !_.isEmpty(form.value.end_user_conditions))

  const customFieldById = getInstanceByFullName(TICKET_FIELD_CUSTOM_FIELD_OPTION, instances)
  const ticketFieldById = getInstanceByFullName(TICKET_FIELD_TYPE_NAME, instances)

  sortConditions(formAgentInstances, 'agent_conditions', customFieldById)
  sortConditions(formUserInstances, 'end_user_conditions', customFieldById)
  sortChildFields(formInstances, ticketFieldById)
}

// The order is irrelevant and cannot be changed
// We need to make it constant between environments
const orderViewCustomFields = (instances: InstanceElement[]): void => {
  instances
    .filter(e => e.elemID.typeName === VIEW_TYPE_NAME)
    .forEach(view => {
      const customFields = view.value.execution?.custom_fields
      if (_.isArray(customFields)) {
        view.value.execution.custom_fields = _.sortBy(customFields, ['title', 'type'])
      } else if (customFields !== undefined) {
        log.warn(`orderViewCustomFields - custom fields are not an array in ${view.elemID.getFullName()}`)
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
    orderMacroAndViewRestrictions(instances)
    orderFormCondition(instances)
    orderViewCustomFields(instances)
  },
})

export default filterCreator
