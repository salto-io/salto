/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ChangeError, getChangeData, isObjectType } from '@salto-io/adapter-api'
import { IS_LOCKED } from '../constants'
import { getElementValueOrAnnotations, isCustomRecordType } from '../types'
import { NetsuiteChangeValidator } from './types'

const changeValidator: NetsuiteChangeValidator = async changes =>
  changes
    .filter(change => Object.values(change.data).some(element => getElementValueOrAnnotations(element)[IS_LOCKED]))
    .map(getChangeData)
    .filter(isObjectType)
    .filter(isCustomRecordType)
    .map(
      ({ elemID }): ChangeError => ({
        elemID,
        severity: 'Error',
        message: 'Cannot add, modify, or remove locked custom record types',
        detailedMessage:
          'Cannot create, modify or remove locked custom record types.' +
          ' To manage locked objects, please manually install or update their bundle in the target account.',
      }),
    )

export default changeValidator
