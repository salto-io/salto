/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ChangeValidator,
  getChangeData,
  isAdditionChange,
  isInstanceChange,
  isInstanceElement,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { EMAIL_DOMAIN_TYPE_NAME, BRAND_TYPE_NAME } from '../constants'

const { awu } = collections.asynciterable

export const emailDomainAdditionValidator: ChangeValidator = async (changes, elementsSource) => {
  if (!elementsSource) {
    return []
  }

  return awu(changes)
    .filter(isInstanceChange)
    .filter(isAdditionChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === EMAIL_DOMAIN_TYPE_NAME)
    .filter(async emailDomainInstance =>
      // Check if there is at least one brand that uses the email domain, return True if there isn't.
      awu(await elementsSource.getAll())
        .filter(isInstanceElement)
        .filter(instance => instance.elemID.typeName === BRAND_TYPE_NAME)
        .filter(brandInstance => isReferenceExpression(brandInstance.value.emailDomainId))
        .filter(brandInstance => brandInstance.value.emailDomainId.elemID.isEqual(emailDomainInstance.elemID))
        .isEmpty(),
    )
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Error' as const,
      message: 'Cannot add email domain without at least one brand that uses it',
      detailedMessage: 'Cannot add email domain without at least one brand that uses it',
    }))
    .toArray()
}
