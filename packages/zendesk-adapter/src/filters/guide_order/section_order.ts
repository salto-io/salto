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
import { CATEGORY_TYPE_NAME, SECTION_TYPE_NAME, SECTIONS_FIELD, SECTION_ORDER_TYPE_NAME } from '../../constants'
import {
  createOrderInstance, deployOrderChanges, createOrderType,
} from './guide_order_utils'
import { FETCH_CONFIG, isGuideEnabled } from '../../config'

/**
 * Handles the section orders inside category
 */
const filterCreator: FilterCreator = ({ client, config }) => ({
  name: 'sectionOrderFilter',
  /** Create an InstanceElement of the sections order inside the categories */
  onFetch: async (elements: Element[]) => {
    // If Guide is not enabled in Salto, we don't need to do anything
    if (!isGuideEnabled(config[FETCH_CONFIG])) {
      return
    }

    const sections = elements.filter(isInstanceElement)
      .filter(e => e.elemID.typeName === SECTION_TYPE_NAME)
    const categories = elements.filter(isInstanceElement)
      .filter(e => e.elemID.typeName === CATEGORY_TYPE_NAME)

    const orderType = createOrderType(SECTION_TYPE_NAME)
    _.remove(elements, e => e.elemID.getFullName() === orderType.elemID.getFullName())
    elements.push(orderType)

    /** Sections in category */
    const sectionsInCategoryOrderElements = categories.map(category => createOrderInstance({
      parent: category,
      parentField: 'category_id',
      orderField: SECTIONS_FIELD,
      // Make sure these sections are not under another section
      childrenElements: sections.filter(s => s.value.direct_parent_type === CATEGORY_TYPE_NAME),
      orderType,
    }))

    /** Sections in section */
    const sectionsInSectionOrderElements = sections.map(section => createOrderInstance({
      parent: section,
      parentField: 'parent_section_id',
      orderField: SECTIONS_FIELD,
      childrenElements: sections.filter(s => s.value.direct_parent_type === SECTION_TYPE_NAME),
      orderType,
    }))

    sectionsInCategoryOrderElements.forEach(element => elements.push(element))
    sectionsInSectionOrderElements.forEach(element => elements.push(element))
  },
  /** Change the sections positions to their order in the category */
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [sectionOrderChanges, leftoverChanges] = _.partition(
      changes,
      change => getChangeData(change).elemID.typeName === SECTION_ORDER_TYPE_NAME,
    )

    const deployResult = await deployOrderChanges({
      changes: sectionOrderChanges,
      orderField: SECTIONS_FIELD,
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
