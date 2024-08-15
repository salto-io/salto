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
  isInstanceChange,
  isModificationChange,
  isReferenceExpression,
  SeverityLevel,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { GUIDE_THEME_TYPE_NAME } from '../constants'

const log = logger(module)

const MANIFEST_FIELDS = ['name']
/**
 * this change validator checks:
 * 1. that there has been no change to the theme name. to change the theme metadata the user
 * needs to update the manifest file and not the nacl
 * 2. that the brand_id didn't change as it is not possible to move themes between brands
 */
export const guideThemeUpdateMetadataValidator: ChangeValidator = async changes => {
  const updatedThemes = changes
    .filter(isInstanceChange)
    .filter(isModificationChange)
    .filter(change => getChangeData(change).elemID.typeName === GUIDE_THEME_TYPE_NAME)

  const manifestChanges = updatedThemes
    .filter(theme => {
      const { before, after } = theme.data
      return MANIFEST_FIELDS.some(field => before.value[field] !== after.value[field])
    })
    .map(theme => ({
      elemID: getChangeData(theme).elemID,
      message: 'Updating theme fields has no effect',
      severity: 'Warning' as SeverityLevel,
      detailedMessage: `Updating the theme fields ${MANIFEST_FIELDS.join(', ')} has no effect. To update them, please edit the manifest.json file`,
    }))

  const unsupportedChanges = updatedThemes
    .filter(theme => {
      const { before, after } = theme.data
      if (isReferenceExpression(before.value.brand_id) && isReferenceExpression(after.value.brand_id)) {
        return !before.value.brand_id.elemID.isEqual(after.value.brand_id.elemID)
      }
      if (_.isNumber(before.value.brand_id) && _.isNumber(after.value.brand_id)) {
        return before.value.brand_id !== after.value.brand_id
      }
      log.warn('brand_id does not have the same type in the before and the after')
      return true
    })
    .map(theme => ({
      elemID: getChangeData(theme).elemID,
      message: 'Moving a theme to a different brand is not supported',
      severity: 'Error' as SeverityLevel,
      detailedMessage: 'Moving a theme to a different brand is not supported',
    }))

  return [...manifestChanges, ...unsupportedChanges]
}
