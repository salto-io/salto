/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Element, getRestriction } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { FLOW_METADATA_VALUE_METADATA_TYPE } from '../constants'
import { findObjectType } from './utils'

/**
 * Create filter that handles flow type/instances corner case.
 */
const filterCreator: FilterCreator = () => ({
  name: 'flowFilter',
  /**
   * Upon fetch remove restriction values from flowMetadataValue.name.
   *
   * @param elements the already fetched elements
   */
  onFetch: async (elements: Element[]): Promise<void> => {
    // fix flowMetadataValue - mark restriction values as not enforced, see: SALTO-93
    const flowMetadataValue = findObjectType(elements, FLOW_METADATA_VALUE_METADATA_TYPE)
    if (flowMetadataValue && flowMetadataValue.fields.name) {
      getRestriction(flowMetadataValue.fields.name).enforce_value = false
    }
  },
})

export default filterCreator
