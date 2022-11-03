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
  isInstanceElement, isRemovalChange, ModificationChange, ReferenceExpression,
} from '@salto-io/adapter-api'
import { detailedCompare } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { FilterCreator } from '../filter'
import { BRAND_TYPE_NAME, CATEGORY_TYPE_NAME } from '../constants'
import { deployChange, deployChanges } from '../deployment'
import { LOGO_FIELD } from './brand_logo'

export const CATEGORIES_FIELD = 'categories'

/* Split the changes into 3 groups:
  onlyOrderChanges    - Brands with only categories order changes
  mixedChanges        - Brands with categories order and other changes
  onlyNonOrderChanges - Brands without any categories order changes
 */
const sortBrandChanges = (changes: Change<InstanceElement>[]) :
    [ ModificationChange<InstanceElement>[],
      ModificationChange<InstanceElement>[],
      Change<InstanceElement>[]] => {
  const onlyOrderChanges : ModificationChange<InstanceElement>[] = []
  const mixedChanges : ModificationChange<InstanceElement>[] = []
  const onlyNonOrderChanges : Change<InstanceElement>[] = []

  changes.forEach(change => {
    if (isRemovalChange(change)) {
      onlyNonOrderChanges.push(change)
      return
    }
    // currently isn't supported because categories can't exist before brand
    if (isAdditionChange(change)) {
      onlyNonOrderChanges.push(change)
      return
    }
    const brandChanges = detailedCompare(change.data.before, change.data.after)
    const hasAnyOrderChanges = brandChanges.some(c =>
      c.id.getFullNameParts().includes(CATEGORIES_FIELD))
    const hasOnlyOrderChanges = brandChanges.every(c =>
      c.id.getFullNameParts().includes(CATEGORIES_FIELD))

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
    const categories = elements.filter(isInstanceElement)
      .filter(e => e.elemID.typeName === CATEGORY_TYPE_NAME)
    const brands = elements.filter(isInstanceElement)
      .filter(e => e.elemID.typeName === BRAND_TYPE_NAME)

    // Insert the categories of that brand to the brand, sorted
    brands.forEach(brand => {
      // If the brand doesn't have Guide activated, do nothing
      if (!brand.value.has_help_center) { return }

      // Lowest position index first, if there is a tie - the newer is first
      const brandsCategories = _.sortBy(
        categories.filter(c => c.value.brand === brand.value.id),
        (c => [c.value.position, -c.value.createdAt])
      )

      brand.value[CATEGORIES_FIELD] = brandsCategories
        .map(c => new ReferenceExpression(c.elemID, c))
    })
  },
  /** Change the categories positions according to their order in the brand, and deploy the brand */
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [brandChanges, leftoverChanges] = _.partition(
      changes,
      change => getChangeData(change).elemID.typeName === BRAND_TYPE_NAME,
    )

    const [onlyOrderChanges, mixedChanges, onlyNonOrderChanges] = sortBrandChanges(brandChanges)

    const orderChangesToApply: Change<InstanceElement>[] = []

    const orderChanges = [...onlyOrderChanges, ...mixedChanges]
    orderChanges.forEach(brandChange => {
      const brandValue = brandChange.data.after.value
      const categories = brandValue.categories.map((c: ReferenceExpression) => c.value)

      categories.forEach((category: InstanceElement, i : number) => {
        // Create a 'fake' change of the category's position
        const beforeCategory = new InstanceElement(
          category.elemID.name,
          category.refType,
          { id: category.value.id, position: category.value.position }
        )
        const afterCategory = beforeCategory.clone()
        afterCategory.value.position = i

        orderChangesToApply.push({
          action: 'modify',
          data: {
            before: beforeCategory,
            after: afterCategory,
          },
        })
      })
    })

    const orderChangesDeployResult = await deployChanges(
      orderChangesToApply,
      async change => {
        await deployChange(change, client, config.apiDefinitions)
      }
    )

    // Ignores the logo and categories field from brand instances when deploying,
    // logos are covered as brand_logo instances, categories were converted to orderChangesToApply
    const brandChangesDeployResult = await deployChanges(
      [...onlyOrderChanges, ...mixedChanges, ...onlyNonOrderChanges],
      async change => {
        await deployChange(change, client, config.apiDefinitions, [LOGO_FIELD, CATEGORIES_FIELD])
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
