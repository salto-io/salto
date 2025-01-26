/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _, { isEmpty } from 'lodash'
import { Change, Element, getChangeData, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { FilterCreator } from '../../filter'
import { ARTICLE_TYPE_NAME, SECTION_TYPE_NAME, ARTICLES_FIELD, ARTICLE_ORDER_TYPE_NAME } from '../../constants'
import { createOrderInstance, deployOrderChanges, createOrderType } from './guide_order_utils'
import { FETCH_CONFIG, isGuideEnabled } from '../../config'

/**
 * Handles the sections and articles orders inside section
 */
const filterCreator: FilterCreator = ({ client, config, oldApiDefinitions }) => ({
  name: 'articleOrderFilter',
  /** Create an InstanceElement of the sections and articles order inside the sections */
  onFetch: async (elements: Element[]) => {
    // If Guide is not enabled in Salto, we don't need to do anything
    if (!isGuideEnabled(config[FETCH_CONFIG])) {
      return
    }

    const articles = elements.filter(isInstanceElement).filter(e => e.elemID.typeName === ARTICLE_TYPE_NAME)
    const sections = elements.filter(isInstanceElement).filter(e => e.elemID.typeName === SECTION_TYPE_NAME)

    const orderType = createOrderType(ARTICLE_TYPE_NAME)
    _.remove(elements, e => e.elemID.getFullName() === orderType.elemID.getFullName())
    elements.push(orderType)

    sections.forEach(section => {
      const articleOrderElements = createOrderInstance({
        parent: section,
        parentField: 'section_id',
        orderField: ARTICLES_FIELD,
        childrenElements: articles,
        orderType,
      })

      if (!isEmpty(articleOrderElements.value[ARTICLES_FIELD])) {
        // Promoted articles are first
        articleOrderElements.value[ARTICLES_FIELD] = _.sortBy(
          articleOrderElements.value[ARTICLES_FIELD],
          a => !a.value.value.promoted,
        )
      }

      elements.push(articleOrderElements)
    })
  },
  /** Change the section and articles positions according to their order in the section */
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [articleOrderChanges, leftoverChanges] = _.partition(
      changes,
      change => getChangeData(change).elemID.typeName === ARTICLE_ORDER_TYPE_NAME,
    )

    const deployResult = await deployOrderChanges({
      changes: articleOrderChanges,
      orderField: ARTICLES_FIELD,
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
