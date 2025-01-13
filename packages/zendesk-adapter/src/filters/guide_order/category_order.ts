/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { Change, Element, getChangeData, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { FilterCreator } from '../../filter'
import { CATEGORY_TYPE_NAME, CATEGORIES_FIELD, CATEGORY_ORDER_TYPE_NAME } from '../../constants'
import { createOrderInstance, deployOrderChanges, createOrderType } from './guide_order_utils'
import { FETCH_CONFIG, isGuideEnabled } from '../../config'
import { getBrandsForGuide } from '../utils'

/**
 * Handle the order of categories in brand
 */
const filterCreator: FilterCreator = ({ client, config, oldApiDefinitions }) => ({
  name: 'categoryOrderFilter',
  /** Create an InstanceElement of the categories order inside the brands */
  onFetch: async (elements: Element[]) => {
    // If Guide is not enabled in Salto, we don't need to do anything
    if (!isGuideEnabled(config[FETCH_CONFIG])) {
      return
    }
    const instances = elements.filter(isInstanceElement)
    const categories = instances.filter(e => e.elemID.typeName === CATEGORY_TYPE_NAME)
    const brands = getBrandsForGuide(instances, config[FETCH_CONFIG])

    const orderType = createOrderType(CATEGORY_TYPE_NAME)
    _.remove(elements, e => e.elemID.getFullName() === orderType.elemID.getFullName())
    elements.push(orderType)

    const categoryOrderElements = brands.map(brand =>
      createOrderInstance({
        parent: brand,
        parentField: 'brand',
        orderField: CATEGORIES_FIELD,
        childrenElements: categories,
        orderType,
      }),
    )
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
      apiDefinitions: oldApiDefinitions,
    })

    return {
      deployResult,
      leftoverChanges,
    }
  },
})

export default filterCreator
