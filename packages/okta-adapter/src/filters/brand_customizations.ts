/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'

const log = logger(module)

const brandCustomizationsFilter: FilterCreator = ({ config: { fetch } }) => ({
  name: 'brandCustomizationsFilter',
  onFetch: async _elements => {
    if (!fetch.enableBrandReferences) {
      return
    }
    log.debug('extracting references in brand customizations elements')
  },
})

export default brandCustomizationsFilter
