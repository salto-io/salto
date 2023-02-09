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
  Change, Element, getChangeData,
  InstanceElement,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { FilterCreator } from '../../filter'
import { ARTICLE_TYPE_NAME, SECTION_TYPE_NAME, ARTICLES_FIELD, ARTICLE_ORDER_TYPE_NAME } from '../../constants'
import { createOrderInstance, deployOrderChanges, createOrderType } from './guide_order_utils'
import { FETCH_CONFIG, isGuideEnabled } from '../../config'

/**
 * Handles the sections and articles orders inside section
 */
const filterCreator: FilterCreator = ({ client, config }) => ({
  name: 'articleOrderFilter',
  /** Create an InstanceElement of the sections and articles order inside the sections */
  onFetch: async (elements: Element[]) => {
    // If Guide is not enabled in Salto, we don't need to do anything
    if (!isGuideEnabled(config[FETCH_CONFIG])) {
      return
    }

    const articles = elements.filter(isInstanceElement)
      .filter(e => e.elemID.typeName === ARTICLE_TYPE_NAME)
    const sections = elements.filter(isInstanceElement)
      .filter(e => e.elemID.typeName === SECTION_TYPE_NAME)

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

      // Promoted articles are first
      articleOrderElements.value[ARTICLES_FIELD] = _.sortBy(
        articleOrderElements.value[ARTICLES_FIELD], a => !a.value.value.promoted
      )

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
      config,
    })

    return {
      deployResult,
      leftoverChanges,
    }
  },
})

export default filterCreator
