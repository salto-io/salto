/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { isReferenceExpression } from '@salto-io/adapter-api'
import { filters, filterUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'

const log = logger(module)

const pathMapper: filters.PathMapperFunc = inst => {
  const { typeName } = inst.elemID
  const { parentOrgUnitId } = inst.value
  if (typeName !== 'orgUnit' || parentOrgUnitId === undefined) {
    return undefined
  }
  if (!isReferenceExpression(parentOrgUnitId)) {
    log.warn('org unit %s has a non-reference parentOrgUnitId', inst.elemID.getFullName())
    return undefined
  }
  const pathSuffix = inst.path?.slice(-2)
  if (pathSuffix?.length !== 2) {
    log.warn('org unit %s does not have the expected path, not updating', inst.elemID.getFullName())
    return undefined
  }
  return {
    nestUnder: parentOrgUnitId.elemID,
    pathSuffix,
  }
}

const filter: filterUtils.NoOptionsFilterCreator<filterUtils.FilterResult> =
  filters.customPathsFilterCreator(pathMapper)

export default filter
