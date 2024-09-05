/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  ElemID,
  InstanceElement,
  isInstanceElement,
  isReferenceExpression,
  ReadOnlyElementsSource,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { BRAND_TYPE_NAME } from '../../../constants'

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
