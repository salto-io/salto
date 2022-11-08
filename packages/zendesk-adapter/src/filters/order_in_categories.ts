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
import { CATEGORY_TYPE_NAME, SECTION_TYPE_NAME } from '../constants'
import { deployOrderChanges, SECTIONS_FIELD, sortChanges } from './guide_order_utils'

/**
 * Handles the section orders inside category
 */
const filterCreator: FilterCreator = ({ client, config, elementsSource }) => ({
  /** Insert the category's section into a field in it */
  onFetch: async (elements: Element[]) => {
    const sections = elements.filter(isInstanceElement)
      .filter(e => e.elemID.typeName === SECTION_TYPE_NAME)
    const categories = elements.filter(isInstanceElement)
      .filter(e => e.elemID.typeName === CATEGORY_TYPE_NAME)


    // Insert the sections of that category to the category, sorted
    categories.forEach(category => {
      // Lowest position index first, if there is a tie - the newer is first
      const categorySections = _.orderBy(sections
        .filter(s => s.value.parent_section_id === undefined)
        .filter(s => s.value.category_id === category.value.id),
      ['value.position', 'value.created_at'], ['asc', 'desc'])

      category.value[SECTIONS_FIELD] = categorySections
        .map(s => new ReferenceExpression(s.elemID, s))
    })
  },
  /** Change the sections positions to their order in the category, and deploy the category */
  deploy: async (changes: Change<InstanceElement>[]) => {
    const categoryChanges = changes.filter(
      c => getChangeData(c).elemID.typeName === CATEGORY_TYPE_NAME
    )

    const { withOrderChanges } = sortChanges(categoryChanges, SECTIONS_FIELD)

    const { errors: orderChangeErrors } = await deployOrderChanges({
      changes: withOrderChanges,
      orderField: SECTIONS_FIELD,
      client,
      config,
      elementsSource,
    })

    return {
      deployResult: {
        appliedChanges: [],
        errors: orderChangeErrors,
      },
      leftoverChanges: changes,
    }
  },
})

export default filterCreator
