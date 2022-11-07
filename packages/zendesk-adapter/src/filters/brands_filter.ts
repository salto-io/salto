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
import { BRAND_TYPE_NAME, CATEGORY_TYPE_NAME } from '../constants'
import { deployChange, deployChanges } from '../deployment'
import { LOGO_FIELD } from './brand_logo'
import { deployOrderChanges, sortChanges } from './guide_order_utils'

export const CATEGORIES_FIELD = 'categories'
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

    const {
      withOrderChanges,
      onlyNonOrderChanges,
    } = sortChanges(brandChanges, CATEGORIES_FIELD)

    const { errors: orderChangeErrors } = await deployOrderChanges({
      changes: withOrderChanges,
      orderField: CATEGORIES_FIELD,
      client,
      config,
    })

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
        appliedChanges: [
          ...brandChangesDeployResult.appliedChanges,
        ],
        errors: [
          ...orderChangeErrors,
          ...brandChangesDeployResult.errors,
        ],
      },
      leftoverChanges,
    }
  },
})

export default filterCreator
