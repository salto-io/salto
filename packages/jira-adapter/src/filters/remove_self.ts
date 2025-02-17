/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Element, isInstanceElement, isObjectType } from '@salto-io/adapter-api'
import { transformValuesSync } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'

/**
 * Removes 'self' values from types and instances
 */
const filter: FilterCreator = () => ({
  name: 'removeSelfFilter',
  onFetch: async (elements: Element[]) => {
    elements.filter(isInstanceElement).forEach(instance => {
      instance.value =
        transformValuesSync({
          values: instance.value,
          type: instance.getTypeSync(),
          pathID: instance.elemID,
          strict: false,
          allowEmptyArrays: true,
          allowExistingEmptyObjects: true,
          transformFunc: ({ value, path }) => {
            if (path?.name === 'self') {
              return undefined
            }
            return value
          },
        }) ?? {}
    })
    elements.filter(isObjectType).forEach(type => {
      delete type.fields.self
    })
  },
})

export default filter
