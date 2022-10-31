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
  InstanceElement, isAdditionChange,
  isInstanceElement, isRemovalChange, ReferenceExpression,
} from '@salto-io/adapter-api'
import { detailedCompare } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { FilterCreator } from '../filter'
import { BRAND_TYPE_NAME } from '../constants'
import { deployChange, deployChanges } from '../deployment'
import { LOGO_FIELD } from './brand_logo'

// Lowest position index first, if there is a tie - the newer is first
const compareCategoriesPosition = (a: InstanceElement, b: InstanceElement) : number => {
  const { position: aPosition, createAt: aCreatedAt } = a.value
  const { position: bPosition, createAt: bCreatedAt } = b.value
  if (aPosition !== bPosition) {
    // Smallest position is first
    return aPosition < bPosition ? 0 : 1
  }
  // Newest is first
  return aCreatedAt > bCreatedAt ? 0 : 1
}

/* Split the changes into 3 groups:
  onlyOrderChanges    - Brands with only categories order changes
  mixedChanges        - Brands with categories order and other changes
  onlyNonOrderChanges - Brands without any categories order changes
 */
const sortBrandChanges = (changes: Change<InstanceElement>[]) :
    [Change<InstanceElement>[], Change<InstanceElement>[], Change<InstanceElement>[]] => {
  const onlyOrderChanges : Change<InstanceElement>[] = []
  const mixedChanges : Change<InstanceElement>[] = []
  const onlyNonOrderChanges : Change<InstanceElement>[] = []

  changes.forEach(change => {
    if (isRemovalChange(change)) {
      onlyNonOrderChanges.push(change)
      return
    }
    // TODO: currently can't handle it since categories can't exist before brand
    if (isAdditionChange(change)) {
      onlyNonOrderChanges.push(change)
      return
    }
    const brandChanges = detailedCompare(change.data.before, change.data.after)
    const hasAnyOrderChanges = brandChanges.some(c => c.id.getFullNameParts().includes('categories'))
    const hasOnlyOrderChanges = brandChanges.every(c => c.id.getFullNameParts().includes('categories'))

    if (hasOnlyOrderChanges) {
      onlyOrderChanges.push(change)
    } else if (hasAnyOrderChanges) {
      mixedChanges.push(change)
    } else {
      onlyNonOrderChanges.push(change)
    }
  })

  return [onlyOrderChanges, mixedChanges, onlyNonOrderChanges]
}

/**
 * something
 */
const filterCreator: FilterCreator = ({ client, config }) => ({
  onFetch: async (elements: Element[]) => {
    const categories = elements.filter(isInstanceElement).filter(e => e.elemID.typeName === 'category') // TODO: is category a const somewhere?
    const brands = elements.filter(isInstanceElement)
      .filter(e => e.elemID.typeName === BRAND_TYPE_NAME)

    // Insert the categories of that brand to the brand, sorted
    brands.forEach(brand => {
      // If the brand doesn't have Guide activated, do nothing
      if (!brand.value.has_help_center) { return }

      const brandsCategories = categories.filter(c =>
        c.value.brand === brand.value.id).sort(compareCategoriesPosition)

      brand.value.categories = brandsCategories.map(c => new ReferenceExpression(c.elemID, c))
    })
  },
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [brandChanges, leftoverChanges] = _.partition(
      changes,
      change => getChangeData(change).elemID.typeName === BRAND_TYPE_NAME,
    )

    const [onlyOrderChanges, mixedChanges, onlyNonOrderChanges] = sortBrandChanges(brandChanges)

    const orderChangesToApply: Change<InstanceElement>[] = []
    for (const brandChange of [...onlyOrderChanges, ...mixedChanges]) {
      // TODO
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const { categories } = brandChange.data.after.value
      categories.forEach((category: InstanceElement, i : number) => {
        // We only need to update the category position if it was changed
        // If the position matched the index in the list, nothing needs to be done
        if (category.value.position !== i) {
          const modifiedCategory = category.clone()
          modifiedCategory.value.position = i
          orderChangesToApply.push({
            action: 'modify',
            data: {
              before: category,
              after: modifiedCategory,
            },
          })
        }
      })
    }

    // Ignores the logo and categories field from brand instances when deploying,
    // logos are covered as brand_logo instances, categories were converted to other changesToApply
    const deployResult = await deployChanges(
      [...orderChangesToApply, ...mixedChanges, ...onlyNonOrderChanges],
      async change => {
        await deployChange(change, client, config.apiDefinitions, [LOGO_FIELD, 'categories'])
      }
    )

    return {
      deployResult,
      leftoverChanges,
    }
  },
})

export default filterCreator
