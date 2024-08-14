/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ChangeValidator, getChangeData, isInstanceChange, isRemovalChange } from '@salto-io/adapter-api'
import { BRAND_TYPE_NAME } from '../constants'

export const brandRemovalValidator: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .filter(isRemovalChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === BRAND_TYPE_NAME)
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Warning',
      message: 'Brand removal includes all of its theme assets, custom code, emails, pages, and settings',
      detailedMessage:
        'Deleting this brand will remove all of its theme assets, custom code, emails, pages, and settings. This action is not reversible.',
    }))
