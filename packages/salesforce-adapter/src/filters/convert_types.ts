/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Element, isObjectType, isInstanceElement } from '@salto-io/adapter-api'
import { transformValuesSync } from '@salto-io/adapter-utils'
import wu from 'wu'
import { FilterCreator } from '../filter'
import { transformPrimitive } from '../transformers/transformer'

/**
 * Convert types of values in instance elements to match the expected types according to the
 * instance type definition.
 */
const filterCreator: FilterCreator = () => ({
  name: 'convertTypeFilter',
  /**
   * Upon fetch, convert all instance values to their correct type according to the
   * type definitions
   *
   * @param elements the already fetched elements
   */
  onFetch: async (elements: Element[]) => {
    wu(elements)
      .filter(isInstanceElement)
      .filter(instance => isObjectType(instance.getTypeSync()))
      .forEach(instance => {
        instance.value =
          transformValuesSync({
            values: instance.value,
            type: instance.getTypeSync(),
            transformFunc: transformPrimitive,
            strict: false,
            allowEmptyArrays: true,
            allowExistingEmptyObjects: true,
          }) || {}
      })
  },
})

export default filterCreator
