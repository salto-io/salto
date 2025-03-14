/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ChangeValidator, getChangeData, isAdditionChange, isInstanceChange } from '@salto-io/adapter-api'
import { DOMAIN_TYPE_NAME } from '../constants'

export const domainAdditionValidator: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .filter(isAdditionChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === DOMAIN_TYPE_NAME)
    .filter(instance => instance.value.brandId === undefined)
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Error',
      message: 'Cannot add domain without a brand',
      detailedMessage: 'Cannot add domain without a brand',
    }))
