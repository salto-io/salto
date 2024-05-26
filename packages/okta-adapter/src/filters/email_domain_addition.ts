/*
 *                      Copyright 2024 Salto Labs Ltd.
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
  getChangeData,
  isAdditionChange,
  isInstanceChange,
  isInstanceElement,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { FilterCreator } from '../filter'
import { BRAND_TYPE_NAME, EMAIL_DOMAIN_TYPE_NAME } from '../constants'

const { awu } = collections.asynciterable

/**
 * This filter adds a brand ID when creating an email domain, as required by the API.
 *
 * In Okta, each Brand may have an optional single email domain, and email domains may have one or more brands.
 * Therefore, each Brand has an optional reference to its email domain, but the email domain does not have
 * references to its list of brands (and the way to add more brands to the same email domain is to modify brands
 * to reference the email domain).
 *
 * However, the Okta email domain creation API requires a (single) brand ID to be provided. This filter finds all the
 * brands associated with each added email domain and temporarily sets the brand ID in the email domain instance for
 * the deploy action. A separate change validator ensures that at least one brand uses the new email domain.
 */
const filterCreator: FilterCreator = ({ elementsSource }) => ({
  name: 'emailDomainAdditionFilter',
  preDeploy: async changes => {
    await awu(changes)
      .filter(isInstanceChange)
      .filter(isAdditionChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === EMAIL_DOMAIN_TYPE_NAME)
      .forEach(async emailDomain => {
        const [brand] = (await awu(await elementsSource.getAll())
          .filter(isInstanceElement)
          .filter(instance => instance.elemID.typeName === BRAND_TYPE_NAME)
          .filter(brandInstance => isReferenceExpression(brandInstance.value.emailDomainId))
          .filter(brandInstance => brandInstance.value.emailDomainId.elemID.isEqual(emailDomain.elemID))
          .toArray()) ?? [undefined]

        if (brand === undefined) {
          throw new Error(`Brand not found for email domain ${emailDomain.elemID.getFullName()}`)
        }
        // Use the ID directly instead of a reference value to avoid circular references.
        emailDomain.value.brandId = brand.value.id
      })
  },

  onDeploy: async changes => {
    await awu(changes)
      .filter(isInstanceChange)
      .filter(isAdditionChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === EMAIL_DOMAIN_TYPE_NAME)
      .forEach(async emailDomain => {
        emailDomain.value.brandId = undefined
      })
  },
})

export default filterCreator
