/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ChangeValidator, getChangeData, isInstanceChange } from '@salto-io/adapter-api'
import { RLM_DEPLOY_SUPPORTED_TYPES } from '../constants'

export const typesNotSupportedValidator: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(elem => !RLM_DEPLOY_SUPPORTED_TYPES.includes(elem.elemID.typeName))
    .map(element => ({
      elemID: element.elemID,
      severity: 'Error',
      message: 'Operation not supported',
      detailedMessage: `Salto does not support deployment of ${element.elemID.typeName}.`,
    }))
