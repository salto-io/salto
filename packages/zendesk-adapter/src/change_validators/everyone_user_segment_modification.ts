/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ChangeValidator, ElemID, getChangeData, isInstanceChange } from '@salto-io/adapter-api'
import { EVERYONE_USER_TYPE, USER_SEGMENT_TYPE_NAME, ZENDESK } from '../constants'

export const everyoneUserSegmentModificationValidator: ChangeValidator = async changes => {
  const everyoneUserSegmentElemID = new ElemID(ZENDESK, USER_SEGMENT_TYPE_NAME, 'instance', EVERYONE_USER_TYPE)
  return changes
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.isEqual(everyoneUserSegmentElemID))
    .flatMap(instance => [
      {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'The "Everyone" user segment cannot be modified',
        detailedMessage: 'The "Everyone" user segment cannot be modified',
      },
    ])
}
