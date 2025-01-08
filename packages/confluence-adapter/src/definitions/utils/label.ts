/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { definitions } from '@salto-io/adapter-components'
import { validateValue } from './generic'

/**
 * AdjustFunction that converts labels object array to ids array.
 */
export const adjustLabelsToIdsFunc: definitions.AdjustFunctionSingle = async item => {
  const value = validateValue(item.value)
  const labels = _.get(value, 'labels')
  if (_.isEmpty(labels) || !Array.isArray(labels)) {
    return { value }
  }
  return {
    value: {
      ...value,
      labels: labels.map(label => label.id),
    },
  }
}
