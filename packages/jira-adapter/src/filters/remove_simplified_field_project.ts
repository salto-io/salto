/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { isInstanceElement } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { PROJECT_TYPE } from '../constants'

const filter: FilterCreator = () => ({
  name: 'removeSimplifiedFieldProjectFilter',
  onFetch: async elements => {
    elements
      .filter(isInstanceElement)
      .filter(e => e.elemID.typeName === PROJECT_TYPE)
      .forEach(project => {
        delete project.value.simplified
      })
  },
})
export default filter
