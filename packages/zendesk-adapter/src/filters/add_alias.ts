/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { Element, isInstanceElement } from '@salto-io/adapter-api'
import { addAliasToElements, AliasData } from '@salto-io/adapter-components'
import { FilterCreator } from '../filter'
import { THEME_SETTINGS_TYPE_NAME } from '../constants'

const THEME_SETTINGS = 'Theme settings'

const aliasMap: Record<string, AliasData> = {
  [THEME_SETTINGS_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: 'brand',
        referenceFieldName: '_alias',
      },
      {
        constant: THEME_SETTINGS,
      },
    ],
  },
}

// we run this filter only on elements that are created later in the flow (after the collision filter)
const filterCreator: FilterCreator = () => ({
  name: 'addAliasToRemainingTypes',
  onFetch: async (elements: Element[]): Promise<void> => {
    const elementsMap = _.groupBy(elements.filter(isInstanceElement), instance => instance.elemID.typeName)
    addAliasToElements({
      elementsMap,
      aliasMap,
    })
  },
})

export default filterCreator
