/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ChangeValidator, getChangeData, isInstanceChange, isAdditionOrModificationChange } from '@salto-io/adapter-api'
import { APPLICATION_TYPE_NAME } from '../constants'

/**
 * Remind users to update environment-specific fields when moving applications between Okta tenants
 */
export const appUrlsValidator: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === APPLICATION_TYPE_NAME)
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Warning',
      message: 'Update environment-specific values when deploying application elements between Okta tenants',
      detailedMessage:
        'Update environment-specific values, such as URLs and subdomains, when deploying application elements between Okta tenants. Adjust these values by editing the relevant element in Salto.',
    }))
