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
  isReferenceExpression,
  ReadOnlyElementsSource,
} from '@salto-io/adapter-api'
import { definitions } from '@salto-io/adapter-components'
import { getInstancesFromElementSource, validatePlainObject } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { BRAND_TYPE_NAME, EMAIL_DOMAIN_TYPE_NAME } from '../../../constants'

const log = logger(module)

/**
 * Finds all brand instances that reference a given email domain element ID.
 */
export const findReferencingBrands = async (
  emailDomainElemId: ElemID,
  elementsSource: ReadOnlyElementsSource,
): Promise<InstanceElement[]> =>
  (await getInstancesFromElementSource(elementsSource, [BRAND_TYPE_NAME]))
    .filter(brandInstance => isReferenceExpression(brandInstance.value.emailDomainId))
    .filter(brandInstance => brandInstance.value.emailDomainId.elemID.isEqual(emailDomainElemId))

/**
 * Adds a single brand ID that references the added email domain to the request value as required by Okta.
 *
 * If there are multiple brands that reference the email domain, an arbitrary one is chosen.
 * If no brands reference the email domain, an error is thrown.
 */
export const addBrandIdToRequest: definitions.AdjustFunction<definitions.deploy.ChangeAndContext> = async ({
  value,
  context,
}) => {
  validatePlainObject(value, EMAIL_DOMAIN_TYPE_NAME)
  const emailDomainElemId = getChangeData(context.change).elemID
  const [brand] = (await findReferencingBrands(emailDomainElemId, context.elementSource)) ?? []

  if (brand === undefined) {
    const msg = `Brand not found for email domain ${emailDomainElemId.getFullName()}`
    log.error(msg)
    throw new Error(msg)
  }
  // Use the ID directly instead of a reference value to avoid circular references.
  return {
    value: {
      ...value,
      brandId: brand.value.id,
    },
  }
}
