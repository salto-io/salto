/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ChangeValidator, getChangeData, isInstanceChange, isRemovalChange } from '@salto-io/adapter-api'
import { getParents } from '@salto-io/adapter-utils'
import { BRAND_THEME_TYPE_NAME, EMAIL_TEMPLATE_TYPE_NAME } from '../constants'

/**
 * When removing a BrandTheme or EmailTemplate, validate that its Brand is also removed.
 * This change validator ensures that a theme or email customization, can be manually removed only if its Brand is also removed as part of the
 * same deploy action.
 */
export const brandDependentElementRemovalValidator: ChangeValidator = async changes => {
  const removeInstanceChanges = changes.filter(isInstanceChange).filter(isRemovalChange).map(getChangeData)

  const removedDependentInstances = removeInstanceChanges.filter(instance =>
    [BRAND_THEME_TYPE_NAME, EMAIL_TEMPLATE_TYPE_NAME].includes(instance.elemID.typeName),
  )

  const removedNames = new Set(removeInstanceChanges.map(instance => instance.elemID.getFullName()))

  return removedDependentInstances
    .filter(instance => !removedNames.has(getParents(instance)[0]?.elemID.getFullName()))
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Error',
      message: `Cannot remove ${instance.elemID.typeName} if its brand is not also being removed`,
      detailedMessage: 'In order to remove this element, remove its brand as well',
    }))
}
