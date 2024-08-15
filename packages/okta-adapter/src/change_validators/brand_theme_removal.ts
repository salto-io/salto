/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/

import { ChangeValidator, getChangeData, isInstanceChange, isRemovalChange } from '@salto-io/adapter-api'
import { getParents } from '@salto-io/adapter-utils'
import { BRAND_THEME_TYPE_NAME } from '../constants'

/**
 * When removing a BrandTheme, validate that its Brand is also removed.
 *
 * There is always a single BrandTheme instance for each Brand, and it is removed automatically when the Brand is
 * removed. It cannot be removed in Okta by itself.
 *
 * This change validator ensures that a theme can be manually removed only if its Brand is also removed as part of the
 * same deploy action.
 */
export const brandThemeRemovalValidator: ChangeValidator = async changes => {
  const removeInstanceChanges = changes.filter(isInstanceChange).filter(isRemovalChange).map(getChangeData)

  const removedBrandThemeInstances = removeInstanceChanges.filter(
    instance => instance.elemID.typeName === BRAND_THEME_TYPE_NAME,
  )

  const removedNames = new Set(removeInstanceChanges.map(instance => instance.elemID.getFullName()))

  return removedBrandThemeInstances
    .filter(brandTheme => !removedNames.has(getParents(brandTheme)[0]?.elemID.getFullName()))
    .map(brandTheme => ({
      elemID: brandTheme.elemID,
      severity: 'Error',
      message: 'Cannot remove brand theme if its brand is not also being removed',
      detailedMessage: 'In order to remove this brand theme, remove its brand as well',
    }))
}
