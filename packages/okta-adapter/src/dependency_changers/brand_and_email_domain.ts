/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  AdditionChange,
  dependencyChange,
  DependencyChanger,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isInstanceChange,
} from '@salto-io/adapter-api'
import { deployment } from '@salto-io/adapter-components'
import { BRAND_TYPE_NAME, EMAIL_DOMAIN_TYPE_NAME } from '../constants'

type ChangeWithKey = deployment.dependency.ChangeWithKey<AdditionChange<InstanceElement>>

/**
 * For newly added brands and email domains, deploy the brand first and then the email domain.
 *
 * Brand and Email Domains have a many-to-one relationship, where a brand can have only one email domain,
 * so we model the types by having a reference from the brand to the email domain. However, in email domain
 * creation, Okta requires a single brand ID to be added to the request. If both are added in the same
 * deployment, we need to deploy the brand first and then the email domain, so that the brand ID is available
 * when creating the email domain.
 */
export const addedEmailDomainAfterAddedBrand: DependencyChanger = async changes => {
  const additions = Array.from(changes.entries())
    .map(([key, change]) => ({ key, change }))
    .filter(
      (changeWithKey): changeWithKey is ChangeWithKey =>
        isAdditionChange(changeWithKey.change) && isInstanceChange(changeWithKey.change),
    )

  const emailDomainAdditions = additions.filter(
    emailDomain => getChangeData(emailDomain.change).elemID.typeName === EMAIL_DOMAIN_TYPE_NAME,
  )

  const brandAdditions = additions.filter(brand => getChangeData(brand.change).elemID.typeName === BRAND_TYPE_NAME)

  return emailDomainAdditions.flatMap(emailDomain => {
    const emailDomainElemID = getChangeData(emailDomain.change).elemID
    const referencingAddedBrands = brandAdditions.filter(brand =>
      getChangeData(brand.change).value.emailDomainId?.elemID.isEqual(emailDomainElemID),
    )
    if (referencingAddedBrands.length === 0) {
      return []
    }
    return referencingAddedBrands.flatMap(brand => [
      dependencyChange('add', emailDomain.key, brand.key),
      dependencyChange('remove', brand.key, emailDomain.key),
    ])
  })
}
