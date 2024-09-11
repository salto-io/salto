/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  ElemID,
  getChangeData,
  InstanceElement,
  isInstanceElement,
  isReferenceExpression,
  ReadOnlyElementsSource,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { definitions } from '@salto-io/adapter-components'
import { validatePlainObject } from '@salto-io/adapter-utils'
import { BRAND_TYPE_NAME, EMAIL_DOMAIN_TYPE_NAME } from '../../../constants'

const { awu } = collections.asynciterable

export const findReferencingBrands = async (
  emailDomainElemId: ElemID,
  elementsSource: ReadOnlyElementsSource,
): Promise<InstanceElement[]> =>
  awu(await elementsSource.getAll())
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === BRAND_TYPE_NAME)
    .filter(brandInstance => isReferenceExpression(brandInstance.value.emailDomainId))
    .filter(brandInstance => brandInstance.value.emailDomainId.elemID.isEqual(emailDomainElemId))
    .toArray()

export const addBrandIdToRequest: definitions.AdjustFunction<definitions.deploy.ChangeAndContext> = async ({
  value,
  context,
}) => {
  validatePlainObject(value, EMAIL_DOMAIN_TYPE_NAME)
  const emailDomainElemId = getChangeData(context.change).elemID
  const [brand] = (await findReferencingBrands(emailDomainElemId, context.elementSource)) ?? []

  if (brand === undefined) {
    throw new Error(`Brand not found for email domain ${emailDomainElemId.getFullName()}`)
  }
  // Use the ID directly instead of a reference value to avoid circular references.
  return {
    value: {
      ...value,
      brandId: brand.value.id,
    },
  }
}
