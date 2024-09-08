/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import {
  ChangeValidator,
  getChangeData,
  isModificationChange,
  isInstanceChange,
  getAllChangeData,
} from '@salto-io/adapter-api'
import { DOMAIN_TYPE_NAME } from '../constants'

export const domainModificationValidator: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .filter(isModificationChange)
    .filter(change => getChangeData(change).elemID.typeName === DOMAIN_TYPE_NAME)
    .map(getAllChangeData)
    .filter(([before, after]) => !_.isEqual(_.omit(before.value, 'brandId'), _.omit(after.value, 'brandId')))
    .map(([instance]) => ({
      elemID: instance.elemID,
      severity: 'Error',
      message: 'Cannot modify any domain fields except its brand',
      detailedMessage: `Domain ${instance.value.domain} can only modify its brand.`,
    }))
