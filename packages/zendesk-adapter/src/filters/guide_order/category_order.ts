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
import _ from 'lodash'
import {
  Change, Element, getChangeData,
  InstanceElement,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { FilterCreator } from '../../filter'
import { BRAND_TYPE_NAME, CATEGORY_TYPE_NAME, CATEGORIES_FIELD, CATEGORY_ORDER_TYPE_NAME } from '../../constants'
import {
  createOrderInstance, deployOrderChanges, createOrderType,
} from './guide_order_utils'
import { FETCH_CONFIG } from '../../config'

/**
 * Handle the order of categories in brand
 */
const filterCreator: FilterCreator = ({ client, config }) => ({
  /** Create an InstanceElement of the categories order inside the brands */
  onFetch: async (elements: Element[]) => {
    // If Guide is not enabled in Salto, we don't need to do anything
    if (!config[FETCH_CONFIG].enableGuide) {
      return
    }

    const categories = elements.filter(isInstanceElement)
      .filter(e => e.elemID.typeName === CATEGORY_TYPE_NAME)
    const brands = elements.filter(isInstanceElement)
      .filter(e => e.elemID.typeName === BRAND_TYPE_NAME)

    const orderType = createOrderType(CATEGORY_TYPE_NAME)
    _.remove(elements, e => e.elemID.getFullName() === orderType.elemID.getFullName())
    elements.push(orderType)

    const categoryOrderElements = brands
    // If the brand doesn't have Guide activated, do nothing
      .filter(b => b.value.has_help_center).map(brand => createOrderInstance({
        parent: brand,
        parentField: 'brand',
        orderField: CATEGORIES_FIELD,
        childrenElements: categories,
        orderType,
      }))
    categoryOrderElements.forEach(element => elements.push(element))
  },
  /** Change the categories positions according to their order in the brand */
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [categoryOrderChange, leftoverChanges] = _.partition(
      changes,
      change => getChangeData(change).elemID.typeName === CATEGORY_ORDER_TYPE_NAME,
    )

    const deployResult = await deployOrderChanges({
      changes: categoryOrderChange,
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
