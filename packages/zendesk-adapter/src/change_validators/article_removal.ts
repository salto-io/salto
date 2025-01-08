/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ChangeValidator, getChangeData, isInstanceElement, isRemovalChange } from '@salto-io/adapter-api'
import { ARTICLE_TYPE_NAME } from '../constants'

export const articleRemovalValidator: ChangeValidator = async changes =>
  changes
    .filter(isRemovalChange)
    .map(getChangeData)
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === ARTICLE_TYPE_NAME)
    .flatMap(instance => [
      {
        elemID: instance.elemID,
        severity: 'Warning',
        message: 'Article has been archived instead of being deleted',
        detailedMessage: `Permanent deletion of articles must be applied manually, please make sure to delete ${instance.value.name} from the archived list`,
      },
    ])
