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
import Joi from 'joi'
import {
  getChangeData, InstanceElement, isInstanceElement, isObjectType, Element, ReferenceExpression,
  ObjectType, ElemID, ListType, BuiltinTypes,
} from '@salto-io/adapter-api'
import { applyFunctionToChangeData, pathNaclCase } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { elements as elementsUtils } from '@salto-io/adapter-components'
import { FilterCreator } from '../../filter'
import { deployChange } from '../../deployment'
import { createOrderTypeName, createReorderFilterCreator, DeployFuncType } from './creator'
import { ZENDESK } from '../../constants'

export const TYPE_NAME = 'trigger'
export const TRIGGER_CATEGORY_TYPE_NAME = 'trigger_category'
const TRIGGER_ORDER_ENTRY_TYPE_NAME = 'trigger_order_entry'

const { RECORDS_PATH, SUBTYPES_PATH, TYPES_PATH, SETTINGS_NESTED_PATH } = elementsUtils
const log = logger(module)

type TriggerOrderEntry = {
  category: string
  active: number[]
  inactive: number[]
}
const EXPECTED_TRIGGER_ORDER_ENTRY_SCHEMA = Joi.array().items(Joi.object({
  category: Joi.string().required(),
  active: Joi.array().items(Joi.number()),
  inactive: Joi.array().items(Joi.number()),
})).required()

const areTriggerOrderEntries = (value: unknown): value is TriggerOrderEntry[] => {
  const { error } = EXPECTED_TRIGGER_ORDER_ENTRY_SCHEMA.validate(value)
  if (error !== undefined) {
    log.warn(`Received an invalid response for the users values: ${error.message}`)
    return false
  }
  return true
}

const deployFunc: DeployFuncType = async (change, client, apiDefinitions) => {
  const clonedChange = await applyFunctionToChangeData(change, inst => inst.clone())
  const instance = getChangeData(clonedChange)
  const { order } = instance.value
  if (!areTriggerOrderEntries(order)) {
    throw new Error('trigger_order\' order field has an invalid format')
  }
  const triggerCategories = order
    .map(entry => entry.category)
    // We send position + 1, since the position in the service are starting from 1
    .map((id, position) => ({ id, position: position + 1 }))
  const triggers = order
    .flatMap(entry => (entry.active ?? []).concat(entry.inactive ?? []).map((id, position) => ({
      id: id.toString(),
      // We send position + 1, since the position in the service are starting from 1
      position: position + 1,
      category_id: entry.category,
    })))
  instance.value.action = 'patch'
  instance.value.items = { trigger_categories: triggerCategories, triggers }
  delete instance.value.order
  await deployChange(clonedChange, client, apiDefinitions)
}

/**
 * Add trigger order element with all the triggers ordered
 */
const filterCreator: FilterCreator = ({
  config,
  client,
  paginator,
  fetchQuery,
  elementsSource,
}) => ({
  name: 'triggerOrderFilter',
  onFetch: async (elements: Element[]): Promise<void> => {
    const orderTypeName = createOrderTypeName(TYPE_NAME)
    const triggerObjType = elements
      .filter(isObjectType)
      .find(e => e.elemID.name === TYPE_NAME)
    const triggerCategoryObjType = elements
      .filter(isObjectType)
      .find(e => e.elemID.name === TRIGGER_CATEGORY_TYPE_NAME)
    if (triggerObjType === undefined) {
      log.warn('Failed to find the type of trigger')
      return
    }
    if (triggerCategoryObjType === undefined) {
      log.warn('Failed to find the type of trigger_category')
      return
    }
    const triggers = _.sortBy(
      elements
        .filter(isInstanceElement)
        .filter(e => e.elemID.typeName === TYPE_NAME),
      instance => !instance.value.active,
      inst => inst.value.position,
      inst => inst.value.title
    )
      .map(inst => {
        delete inst.value.position
        return inst
      })
    const triggerCategories = _.sortBy(
      elements
        .filter(isInstanceElement)
        .filter(e => e.elemID.typeName === TRIGGER_CATEGORY_TYPE_NAME),
      inst => inst.value.position
    )
      .map(inst => {
        delete inst.value.position
        return inst
      })
    const typeNameNaclCase = pathNaclCase(orderTypeName)
    const entryTypeNameNaclCase = pathNaclCase(TRIGGER_ORDER_ENTRY_TYPE_NAME)
    const entryOrderType = new ObjectType({
      elemID: new ElemID(ZENDESK, TRIGGER_ORDER_ENTRY_TYPE_NAME),
      fields: {
        category: { refType: BuiltinTypes.NUMBER },
        active: { refType: new ListType(BuiltinTypes.NUMBER) },
        inactive: { refType: new ListType(BuiltinTypes.NUMBER) },
      },
      path: [ZENDESK, TYPES_PATH, SUBTYPES_PATH, entryTypeNameNaclCase],
    })
    const type = new ObjectType({
      elemID: new ElemID(ZENDESK, orderTypeName),
      fields: { order: { refType: new ListType(entryOrderType) } },
      isSettings: true,
      path: [ZENDESK, TYPES_PATH, SUBTYPES_PATH, typeNameNaclCase],
    })
    const triggersByCategory = _.groupBy(triggers, ref => ref.value.category_id)
    const order = triggerCategories.map(category => {
      const [active, inactive] = _.partition(
        (triggersByCategory[category.value.id] ?? [])
          .map(inst => new ReferenceExpression(inst.elemID, inst)),
        ref => ref.value.value.active
      )
      return {
        category: new ReferenceExpression(category.elemID, category),
        active,
        inactive,
      }
    })
    const instance = new InstanceElement(
      ElemID.CONFIG_NAME,
      type,
      { order },
      [ZENDESK, RECORDS_PATH, SETTINGS_NESTED_PATH, typeNameNaclCase],
    )
    // Those types already exist since we added the empty version of them
    //  via the add remaining types mechanism. So we first need to remove the old versions
    _.remove(elements, element => [
      type.elemID.getFullName(), entryOrderType.elemID.getFullName(),
    ].includes(element.elemID.getFullName()))
    elements.push(type, entryOrderType, instance)
  },
  deploy: createReorderFilterCreator({
    // todoadi fix this reuse of the name
    filterName: 'triggerOrderFilter',
    typeName: TYPE_NAME,
    orderFieldName: 'order',
    deployFunc,
    activeFieldName: 'active',
  })({ client, config, paginator, fetchQuery, elementsSource }).deploy,
})

export default filterCreator
