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
import { ARTICLE_TYPE_NAME, SECTION_TYPE_NAME } from '../../constants'
import {
  ARTICLES_FIELD,
  ARTICLES_ORDER,
  createOrderInstance,
  createOrderType,
  deployOrderChanges,
} from './guide_orders_utils'

/**
 * Handles the sections and articles orders inside section
 */
const filterCreator: FilterCreator = ({ client, config }) => ({
  /** Create an InstanceElement of the sections and articles order inside the sections */
  onFetch: async (elements: Element[]) => {
    const articles = elements.filter(isInstanceElement)
      .filter(e => e.elemID.typeName === ARTICLE_TYPE_NAME)
    const sections = elements.filter(isInstanceElement)
      .filter(e => e.elemID.typeName === SECTION_TYPE_NAME)

    const orderType = createOrderType(ARTICLE_TYPE_NAME)
    elements.push(orderType)

    sections.forEach(section => {
      const articlesOrderElements = createOrderInstance({
        parent: section,
        parentField: 'section_id',
        orderField: ARTICLES_FIELD,
        childrenElements: articles,
        orderType,
      })

      // Promoted articles are first
      articlesOrderElements.value[ARTICLES_FIELD] = articlesOrderElements.value[ARTICLES_FIELD]
        .sort((a : ReferenceExpression, b : ReferenceExpression) =>
          Number(b.value.value.promoted === true) - Number(a.value.value.promoted === true))

      section.value[ARTICLES_FIELD] = new ReferenceExpression(
        articlesOrderElements.elemID, articlesOrderElements
      )
      elements.push(articlesOrderElements)
    })
  },
  /** Change the section and articles positions according to their order in the section */
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [articlesOrderChanges, leftoverChanges] = _.partition(
      changes,
      change => getChangeData(change).elemID.typeName === ARTICLES_ORDER,
    )

    const deployResult = await deployOrderChanges({
      changes: articlesOrderChanges,
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
