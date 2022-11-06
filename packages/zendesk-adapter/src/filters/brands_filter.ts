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
  InstanceElement, isAdditionChange, isAdditionOrModificationChange,
  isInstanceElement, isRemovalChange, ReferenceExpression, Value,
} from '@salto-io/adapter-api'
import { detailedCompare } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { FilterCreator } from '../filter'
import { BRAND_TYPE_NAME, CATEGORY_TYPE_NAME } from '../constants'
import { deployChange, deployChanges } from '../deployment'
import { LOGO_FIELD } from './brand_logo'

export const CATEGORIES_FIELD = 'categories'

/* Split the changes into 3 groups:
  withOrderChanges    - Brands with categories order changes
  onlyNonOrderChanges - Brands without any categories order changes
 */
const sortBrandChanges = (changes: Change<InstanceElement>[]) :
    {
      withOrderChanges : Change<InstanceElement>[]
      onlyNonOrderChanges : Change<InstanceElement>[]
    } => {
  const withOrderChanges : Change<InstanceElement>[] = []
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
      c.id.createTopLevelParentID().path[0] === CATEGORIES_FIELD)

    if (hasAnyOrderChanges) {
      withOrderChanges.push(change)
    } else {
      onlyNonOrderChanges.push(change)
    }
  })

  return { withOrderChanges, onlyNonOrderChanges }
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
      if (!brand.value.has_help_center) {
        return
      }

      // Lowest position index first, if there is a tie - the newer is first
      const brandsCategories = _.orderBy(
        categories.filter(c => c.value.brand === brand.value.id),
        ['value.position', 'value.created_at'], ['asc', 'desc']
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

    const { withOrderChanges, onlyNonOrderChanges } = sortBrandChanges(brandChanges)

    const orderChangesToApply: Change<InstanceElement>[] = []
    const orderChangeErrors: Error[] = []

    withOrderChanges.filter(isAdditionOrModificationChange).forEach(brandChange => {
      const brandValue = brandChange.data.after.value

      if (!brandValue.categories.every(isReferenceExpression)) {
        orderChangeErrors.push(new Error(`Error updating categories positions of '${brandValue.name}' - some values in the list are not a reference`))
        return
      }
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
      [...withOrderChanges, ...onlyNonOrderChanges],
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
          ...orderChangeErrors,
        ],
      },
      leftoverChanges,
    }
  },
})

export default filterCreator
