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
import {
  Change, Element, getChangeData,
  InstanceElement,
  isInstanceElement, ReferenceExpression,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { FilterCreator } from '../../filter'
import { BRAND_TYPE_NAME, CATEGORY_TYPE_NAME } from '../../constants'
import {
  CATEGORIES_FIELD,
  createOrderElement,
  deployOrderChanges, GUIDE_ORDER_TYPES, ORDER_IN_BRAND_TYPE,
} from './guide_orders_utils'
import { FETCH_CONFIG } from '../../config'

/**
 * Handle everything related to brands
 */
const filterCreator: FilterCreator = ({ client, config }) => ({
  /** Create an InstanceElement of the categories order inside the brands */
  onFetch: async (elements: Element[]) => {
    const categories = elements.filter(isInstanceElement)
      .filter(e => e.elemID.typeName === CATEGORY_TYPE_NAME)
    const brands = elements.filter(isInstanceElement)
      .filter(e => e.elemID.typeName === BRAND_TYPE_NAME)

    // If Guide is not enabled in Salto, we don't need to do anything
    if (!config[FETCH_CONFIG].enableGuide) {
      return
    }

    elements.push(GUIDE_ORDER_TYPES[BRAND_TYPE_NAME])
    // If the brand doesn't have Guide activated, do nothing
    brands.filter(b => b.value.has_help_center).forEach(brand => {
      const orderInBrandElement = createOrderElement({
        parent: brand,
        parentField: 'brand',
        orderField: CATEGORIES_FIELD,
        childrenElements: categories,
      })
      brand.value.categories = new ReferenceExpression(
        orderInBrandElement.elemID, orderInBrandElement
      )
      elements.push(orderInBrandElement)
    })
  },
  /** Change the categories positions according to their order in the brand, and deploy the brand */
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [orderInBrandChanges, leftoverChanges] = _.partition(
      changes,
      change => getChangeData(change).elemID.typeName === ORDER_IN_BRAND_TYPE,
    )

    const deployResult = await deployOrderChanges({
      changes: orderInBrandChanges,
      orderField: CATEGORIES_FIELD,
      client,
      config,
    })

    return {
      deployResult,
      leftoverChanges,
    }
  },
})

export default filterCreator
