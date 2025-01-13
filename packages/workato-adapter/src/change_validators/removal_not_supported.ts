/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ChangeValidator, getChangeData, isInstanceChange, isRemovalChange } from '@salto-io/adapter-api'

export const removalNotSupportedValidator: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .filter(isRemovalChange)
    .map(getChangeData)
    .map(element => ({
      elemID: element.elemID,
      severity: 'Error',
      message: 'Operation not supported',
      detailedMessage: `Salto does not support removal of ${element.elemID.getFullName()}.`,
    }))
