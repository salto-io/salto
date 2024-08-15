/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { isInstanceElement } from '@salto-io/adapter-api'
import { getParents } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { FilterCreator } from '../filter'

const log = logger(module)

/**
 * Filter to remove instances with unresolved parents
 * (can happen if we remove an instance in the duplicate_ids filter)
 */
const filter: FilterCreator = () => ({
  name: 'unresolvedParentsFilter',
  onFetch: async elements => {
    const ids = new Set(elements.map(instance => instance.elemID.getFullName()))
    const removedChildren = _.remove(
      elements,
      element =>
        isInstanceElement(element) && getParents(element).some(parent => !ids.has(parent.elemID.getFullName())),
    )

    if (removedChildren.length > 0) {
      log.warn(
        `Removed instances with unresolved parents: ${removedChildren.map(instance => instance.elemID.getFullName()).join(', ')}`,
      )
    }
  },
})

export default filter
