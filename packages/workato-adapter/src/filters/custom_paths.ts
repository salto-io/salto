/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { isInstanceElement, isReferenceExpression } from '@salto-io/adapter-api'
import { filters, filterUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { FOLDER_TYPE } from '../constants'

const log = logger(module)

const pathMapper: filters.PathMapperFunc = inst => {
  const { typeName } = inst.elemID
  if (typeName !== FOLDER_TYPE) {
    return undefined
  }
  const { parent_id: parentID } = inst.value
  if (!isReferenceExpression(parentID) || !isInstanceElement(parentID.value)) {
    log.warn('folder %s does not reference a valid parent, not updating path', inst.elemID.getFullName())
    return undefined
  }
  const pathSuffix = [_.last(parentID.value.path), _.last(inst.path)].filter(_.isString)
  if (pathSuffix?.length !== 2) {
    log.warn('instance %s does not have the expected path, not updating', inst.elemID.getFullName())
    return undefined
  }
  return {
    nestUnder: parentID.elemID,
    pathSuffix,
  }
}

const filter: filterUtils.NoOptionsFilterCreator<filterUtils.FilterResult> =
  filters.customPathsFilterCreator(pathMapper)

export default filter
