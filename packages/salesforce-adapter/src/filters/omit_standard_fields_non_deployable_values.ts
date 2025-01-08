/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { FIELD_ANNOTATIONS } from '../constants'
import { FilterCreator } from '../filter'
import { ensureSafeFilterFetch, isCustomObjectSync, isStandardField } from './utils'

const filterCreator: FilterCreator = ({ config }) => ({
  name: 'omitStandardFieldsNonDeployableValues',
  onFetch: ensureSafeFilterFetch({
    config,
    warningMessage: 'Error occurred when attempting to omit standard fields non deployable values',
    fetchFilterFunc: async elements =>
      elements
        .filter(isCustomObjectSync)
        .flatMap(customObject => Object.values(customObject.fields))
        .filter(isStandardField)
        .forEach(field => {
          delete field.annotations[FIELD_ANNOTATIONS.VALUE_SET]
          delete field.annotations[FIELD_ANNOTATIONS.REFERENCE_TO]
        }),
  }),
})

export default filterCreator
