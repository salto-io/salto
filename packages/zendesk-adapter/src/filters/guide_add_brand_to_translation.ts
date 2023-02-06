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
import { Element, isInstanceElement } from '@salto-io/adapter-api'
import { getParent } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import {
  ARTICLE_TRANSLATION_TYPE_NAME,
  CATEGORY_TRANSLATION_TYPE_NAME,
  SECTION_TRANSLATION_TYPE_NAME,
} from '../constants'

/**
 * this filter adds brand field to translations since it is created through the standalone mechanism and is not
 * added in its creation.
 */
const filterCreator: FilterCreator = () => ({
  name: 'guideAddBrandToArticleTranslation',
  onFetch: async (elements: Element[]): Promise<void> => {
    elements
      .filter(isInstanceElement)
      .filter(obj => [
        ARTICLE_TRANSLATION_TYPE_NAME,
        CATEGORY_TRANSLATION_TYPE_NAME,
        SECTION_TRANSLATION_TYPE_NAME,
      ].includes(obj.elemID.typeName))
      .forEach(elem => {
        elem.value.brand = getParent(elem).value.brand
      })
  },
})
export default filterCreator
