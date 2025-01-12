/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { isReferenceExpression } from '@salto-io/adapter-api'
import { filters, filterUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { PAGE_TYPE_NAME } from '../constants'

const log = logger(module)

const pathMapper: filters.PathMapperFunc = inst => {
  const { typeName } = inst.elemID
  if (typeName !== PAGE_TYPE_NAME) {
    return undefined
  }
  const { parentId, spaceId } = inst.value
  const currentFileName = _.last(inst.path)
  if (currentFileName === undefined) {
    log.warn('page %s has no path, not updating', inst.elemID.getFullName())
    return undefined
  }
  const pathSuffix = [currentFileName, currentFileName]
  if (isReferenceExpression(parentId)) {
    return {
      nestUnder: parentId.elemID,
      pathSuffix,
    }
  }
  if (!isReferenceExpression(spaceId)) {
    // should not happen
    log.warn('page %s does not reference a space, not updating path', inst.elemID.getFullName())
    return undefined
  }
  return {
    nestUnder: spaceId.elemID,
    pathSuffix: ['pages', ...pathSuffix],
  }
}

const filter: filterUtils.NoOptionsFilterCreator<filterUtils.FilterResult> =
  filters.customPathsFilterCreator(pathMapper)

export default filter
