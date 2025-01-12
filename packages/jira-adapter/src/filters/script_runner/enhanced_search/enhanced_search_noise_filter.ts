/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { isInstanceElement } from '@salto-io/adapter-api'
import { FilterCreator } from '../../../filter'
import { isEnhancedSearchInstance } from '../../../common/script_runner'

const ENHANCED_SEARCH_REPLACE_TEXT = 'ENHANCED_SEARCH_ISSUE_TERMS'

// This filter changes Enhanced Search jql to remove noise
const filter: FilterCreator = () => ({
  name: 'enhancedSearchNoiseReductionFilter',
  onFetch: async elements => {
    elements
      .filter(isInstanceElement)
      .filter(isEnhancedSearchInstance)
      .filter(instance => instance.value.jql?.includes('issue in ('))
      .forEach(instance => {
        // replace 'issue in (' until the end of the bracket with 'ENHANCED_SEARCH_ISSUE_TERMS'
        // the replace is lazy, so it will fail for things like 'issue in (a, (b,c))'
        instance.value.jql = instance.value.jql.replace(/issue in \(.*?\)/, ENHANCED_SEARCH_REPLACE_TEXT)
      })
  },
})
export default filter
