/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { definitions } from '@salto-io/adapter-components'
import { values as lowerdashValues } from '@salto-io/lowerdash'
import _ from 'lodash'

// this transformer adds the brand id to guide elements, to know the source of each element
export const transform: definitions.AdjustFunctionSingle = async ({ value, context }) => {
  if (!lowerdashValues.isPlainObject(value)) {
    throw new Error('unexpected value for guide item, not transforming')
  }
  const brandId = context.brandId ?? _.get(context.parent, 'brand')
  if (brandId === undefined) {
    return { value }
  }

  return {
    value: {
      ...value,
      // Defining Zendesk Guide element to its corresponding brand (= subdomain)
      brand: brandId,
    },
  }
}
