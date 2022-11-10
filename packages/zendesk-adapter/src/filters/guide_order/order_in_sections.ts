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
import { FilterCreator } from '../../filter'
import { ARTICLE_TYPE_NAME, SECTION_TYPE_NAME } from '../../constants'
import {
  ARTICLES_FIELD,
  createOrderElement,
  deployOrderChanges, GUIDE_ORDER_TYPES,
  ORDER_IN_SECTION_TYPE, SECTIONS_FIELD,
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

    elements.push(GUIDE_ORDER_TYPES[SECTION_TYPE_NAME])
    sections.forEach(section => {
      const sectionsInSectionOrderElement = createOrderElement({
        parent: section,
        parentField: 'parent_section_id',
        orderField: SECTIONS_FIELD,
        childrenElements: sections,
      })
      const articlesInSectionOrderElement = createOrderElement({
        parent: section,
        parentField: 'section_id',
        orderField: ARTICLES_FIELD,
        childrenElements: articles,
      })

      section.value[SECTIONS_FIELD] = new ReferenceExpression(
        sectionsInSectionOrderElement.elemID, sectionsInSectionOrderElement
      )

      section.value[ARTICLES_FIELD] = new ReferenceExpression(
        articlesInSectionOrderElement.elemID, articlesInSectionOrderElement
      )
      elements.push(sectionsInSectionOrderElement, articlesInSectionOrderElement)
    })
  },
  /** Change the section and articles positions according to their order in the section */
  deploy: async (changes: Change<InstanceElement>[]) => {
    const orderInSectionChanges = changes.filter(
      c => getChangeData(c).elemID.typeName === ORDER_IN_SECTION_TYPE
    )

    const sectionsInSectionDeployResult = await deployOrderChanges({
      changes: orderInSectionChanges,
      orderField: SECTIONS_FIELD,
      client,
      config,
    })

    const articlesInSectionDeployResult = await deployOrderChanges({
      changes: orderInSectionChanges,
      orderField: ARTICLES_FIELD,
      client,
      config,
    })

    return {
      deployResult: {
        appliedChanges: [
          // Each change is run twice (one on each field), so we removed duplicates
          ...new Set([
            ...sectionsInSectionDeployResult.appliedChanges,
            ...articlesInSectionDeployResult.appliedChanges,
          ]),
        ],
        errors: [
          ...sectionsInSectionDeployResult.errors,
          ...articlesInSectionDeployResult.errors,
        ],
      },
      leftoverChanges: changes,
    }
  },
})

export default filterCreator
