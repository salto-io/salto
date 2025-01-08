/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { filters } from '@salto-io/adapter-components'
import { FilterCreator } from '../filter'
import { FOLDER_TYPE, RECIPE_TYPE, CONNECTION_TYPE, RECIPE_CODE_TYPE } from '../constants'

const ADDITIONAL_PARENT_FIELDS: Record<string, string[]> = {
  [FOLDER_TYPE]: ['parent_id'],
  [RECIPE_TYPE]: ['folder_id'],
  [CONNECTION_TYPE]: ['folder_id'],
}

/**
 * Filter creators of all the common filters
 */
const filterCreators: Record<string, FilterCreator> = {
  hideTypes: filters.hideTypesFilterCreator(),
  referencedInstanceNames: filters.referencedInstanceNamesFilterCreator(),
  query: filters.queryFilterCreator({
    additionalParentFields: ADDITIONAL_PARENT_FIELDS,
    typesToKeep: [RECIPE_CODE_TYPE],
  }),
}

export default filterCreators
