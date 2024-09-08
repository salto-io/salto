/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { definitions } from '@salto-io/adapter-components'
import { values as lowerdashValues } from '@salto-io/lowerdash'
import _ from 'lodash'

// this transformer updates the group objects for queues into the correct format
export const transform: definitions.AdjustFunctionSingle = async ({ value }) => {
  if (!lowerdashValues.isPlainObject(value)) {
    throw new Error('unexpected value for queue item, not transforming')
  }

  const primaryGroupIds = _.map(_.get(value, 'primary_groups.groups'), 'id')
  const secondaryGroupIds = _.map(_.get(value, 'secondary_groups.groups'), 'id')

  return {
    value: {
      ..._.omit(value, ['primary_groups', 'secondary_groups']),
      ...(primaryGroupIds.length > 0 && { primary_groups_id: primaryGroupIds }),
      ...(secondaryGroupIds.length > 0 && { secondary_groups_id: secondaryGroupIds }),
    },
  }
}
