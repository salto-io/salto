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
  Change, DeployResult,
  Element,
  InstanceElement,
  isInstanceElement,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { BRAND_TYPE_NAME } from '../constants'

// TODO: is this really needed? it comes sorted naturally
// const compareCategoriesPosition = (a: InstanceElement, b: InstanceElement) : number => {
//   const { position: aPosition, createAt: aCreatedAt } = a.value
//   const { position: bPosition, createAt: bCreatedAt } = b.value
//   if (aPosition !== bPosition) {
//     // Smallest position is first
//     return aPosition < bPosition ? 0 : 1
//   }
//   // Newest is first
//   return aCreatedAt > bCreatedAt ? 0 : 1
// }

/**
 * something
 */
const filterCreator: FilterCreator = () => ({
  onFetch: async (elements: Element[]) => {
    const categoriesInstances = elements.filter(isInstanceElement).filter(e => e.elemID.typeName === 'category') // TODO: is category a const somewhere?
    const brandInstances = elements.filter(isInstanceElement)
      .filter(e => e.elemID.typeName === BRAND_TYPE_NAME) // TODO: is brand a const somewhere?

    // Insert the categories of that brand to the brand, they are inserted ordered
    for (const brand of brandInstances) {
      const brandsCategories = categoriesInstances.filter(c =>
        c.value.brand.resValue.value.id === brand.value.id) // .sort(compareCategoriesPosition) TODO

      // Number the position of the categories
      // Because two categories can have the same position (and then ordered by creation time)
      for (let i = 0; i < brandsCategories.length; i += 1) {
        brandsCategories[i].value.position = i
      }

      brand.value.categories = brandsCategories.map(c => new ReferenceExpression(c.elemID, c))
    }
  },
  deploy: async (changes: Change<InstanceElement>[]) => {
    // eslint-disable-next-line no-console
    console.log(changes)
    const deployResult = {} as unknown as DeployResult
    return { deployResult, leftoverChanges: [] }
  },
})

export default filterCreator
