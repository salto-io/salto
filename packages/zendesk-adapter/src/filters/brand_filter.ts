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

const extractCategoriesFromChange = (brandChange : Change<InstanceElement>)
    : InstanceElement[] => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const categoryObject = brandChange.data.after.value.categories[0]
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  return categoryObject.brand.resValue.value.categories.map((c : ReferenceExpression) => c.resValue)
}

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
    // currently isn't supported since categories can't exist before brand
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
 * Handle everything related to brands
 */
const filterCreator: FilterCreator = ({ client, config }) => ({
  /** Insert the brand's categories into a field in it */
  onFetch: async (elements: Element[]) => {
    const categories = elements.filter(isInstanceElement).filter(e => e.elemID.typeName === 'category')
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
  /** Change the categories positions according to their order in the brand, and deploy the brand */
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [brandChanges, leftoverChanges] = _.partition(
      changes,
      change => getChangeData(change).elemID.typeName === BRAND_TYPE_NAME,
    )

    const [onlyOrderChanges, mixedChanges, onlyNonOrderChanges] = sortBrandChanges(brandChanges)

    const fieldsToIgnore: Set<string> = new Set<string>()
    const orderChangesToApply: Change<InstanceElement>[] = []
    for (const brandChange of [...onlyOrderChanges, ...mixedChanges]) {
      const categories = extractCategoriesFromChange(brandChange)
      categories.forEach((category: InstanceElement, i : number) => {
        const beforeCategory = category.clone()
        category.value.position = i

        orderChangesToApply.push({
          action: 'modify',
          data: {
            before: beforeCategory,
            after: category,
          },
        })
        Object.keys(category.value).forEach(k => fieldsToIgnore.add(k))
      })
    }

    // We want to only update position, so we ignore any other change
    fieldsToIgnore.delete('position')
    const orderChangesDeployResult = await deployChanges(
      orderChangesToApply,
      async change => {
        await deployChange(change, client, config.apiDefinitions, Array.from(fieldsToIgnore))
      }
    )

    // Ignores the logo and categories field from brand instances when deploying,
    // logos are covered as brand_logo instances, categories were converted to orderChangesToApply
    const brandChangesDeployResult = await deployChanges(
      [...onlyOrderChanges, ...mixedChanges, ...onlyNonOrderChanges],
      async change => {
        await deployChange(change, client, config.apiDefinitions, [LOGO_FIELD, 'categories'])
      }
    )

    return {
      deployResult: {
        // Without orderChangesDeployResult since they are internal 'fake' changes and did not exist
        appliedChanges: brandChangesDeployResult.appliedChanges,
        errors: [
          ...orderChangesDeployResult.errors,
          ...brandChangesDeployResult.errors,
        ],
      },
      leftoverChanges,
    }
  },
})

export default filterCreator
