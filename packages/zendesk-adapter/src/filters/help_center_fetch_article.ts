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
import { Element, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { ARTICLE_TYPE_NAME } from '../constants'
import { FilterCreator } from '../filter'

export const removeTitleAndBody = (elem: InstanceElement): void => {
  delete elem.value.title
  delete elem.value.body
}

/**
 * This filter works as follows: onFetch it discards the 'title' and 'body' fields to avoid
 * data duplication with the default translation. It is separated from
 * article as the removal needs to happen after the reference expressions
 * are created.
 */
const filterCreator: FilterCreator = () => ({
  onFetch: async (elements: Element[]): Promise<void> => {
    elements
      .filter(isInstanceElement)
      .filter(obj => obj.elemID.typeName === ARTICLE_TYPE_NAME)
      .forEach(removeTitleAndBody)
  },
})
export default filterCreator
