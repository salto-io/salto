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
import { FilterCreator } from '../filter'
import { ARTICLE_TYPE_NAME, SECTION_TYPE_NAME } from '../constants'
import { ARTICLES_FIELD, deployOrderChanges, SECTIONS_FIELD, sortChanges } from './guide_order_utils'

/**
 * Handles the sections and articles orders inside section
 */
const filterCreator: FilterCreator = ({ client, config, elementsSource }) => ({
  /** Insert the section's sections and articles into fields in it */
  onFetch: async (elements: Element[]) => {
    const articles = elements.filter(isInstanceElement)
      .filter(e => e.elemID.typeName === ARTICLE_TYPE_NAME)
    const sections = elements.filter(isInstanceElement)
      .filter(e => e.elemID.typeName === SECTION_TYPE_NAME)

    // Insert the sections and articles of that section to the section, sorted
    sections.forEach(section => {
      // Lowest position index first, if there is a tie - the newer is first
      const sectionArticles = _.orderBy(
        articles.filter(a => a.value.section_id === section.value.id),
        ['value.position', 'value.created_at'], ['asc', 'desc']
      )
      const sectionSections = _.orderBy(
        sections.filter(a => a.value.parent_section_id === section.value.id),
        ['value.position', 'value.created_at'], ['asc', 'desc']
      )

      section.value[ARTICLES_FIELD] = sectionArticles
        .map(a => new ReferenceExpression(a.elemID, a))
      section.value[SECTIONS_FIELD] = sectionSections
        .map(a => new ReferenceExpression(a.elemID, a))
    })
  },
  /** Change the section and articles positions according to their order in the section */
  deploy: async (changes: Change<InstanceElement>[]) => {
    const sectionChanges = changes.filter(
      c => getChangeData(c).elemID.typeName === SECTION_TYPE_NAME
    )

    const sortedSectionChanges = sortChanges(sectionChanges, SECTIONS_FIELD)
    const sortedArticleChanges = sortChanges(sectionChanges, ARTICLES_FIELD)

    const { errors: sectionOrderChangeErrors } = await deployOrderChanges({
      changes: sortedSectionChanges.withOrderChanges,
      orderField: SECTIONS_FIELD,
      client,
      config,
      elementsSource,
    })

    const { errors: articleOrderChangeErrors } = await deployOrderChanges({
      changes: sortedArticleChanges.withOrderChanges,
      orderField: ARTICLES_FIELD,
      client,
      config,
      elementsSource,
    })

    return {
      deployResult: {
        appliedChanges: [],
        errors: [
          ...sectionOrderChangeErrors,
          ...articleOrderChangeErrors,
        ],
      },
      leftoverChanges: changes,
    }
  },
})

export default filterCreator
