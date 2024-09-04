/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  ChangeValidator,
  getChangeData,
  isAdditionChange,
  isAdditionOrModificationChange,
  isInstanceChange,
  isInstanceElement,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { EMAIL_DOMAIN_TYPE_NAME, BRAND_TYPE_NAME } from '../constants'

/**
 * Validator to check that an email domain is not added without at least one brand that uses it.
 */
export const emailDomainAdditionValidator: ChangeValidator = async changes => {
  // To find a brand that uses the email domain, only look at changes, since the email domain is new and cannot be
  // referenced by an unchanged brand.
  const brands = changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === BRAND_TYPE_NAME)
    .filter(brandInstance => isReferenceExpression(brandInstance.value.emailDomainId))

  return changes
    .filter(isInstanceChange)
    .filter(isAdditionChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === EMAIL_DOMAIN_TYPE_NAME)
    .filter(emailDomainInstance =>
      // Check if there is at least one brand that uses the email domain, return True if there isn't.
      _.isEmpty(
        brands.filter(brandInstance => brandInstance.value.emailDomainId.elemID.isEqual(emailDomainInstance.elemID)),
      ),
    )
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Error' as const,
      message: 'Cannot add email domain without at least one brand that uses it',
      detailedMessage: 'Cannot add email domain without at least one brand that uses it',
    }))
}
