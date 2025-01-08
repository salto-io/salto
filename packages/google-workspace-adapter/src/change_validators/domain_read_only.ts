/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ChangeValidator, getChangeData, isAdditionChange, isInstanceElement } from '@salto-io/adapter-api'
import { DOMAIN_TYPE_NAME } from '../constants'

export const domainReadOnlyValidator: ChangeValidator = async changes =>
  changes
    .filter(isAdditionChange)
    .map(getChangeData)
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === DOMAIN_TYPE_NAME)
    .filter(
      instance =>
        instance.value.verified === true ||
        instance.value.isPrimary === true ||
        instance.value.domainAliases !== undefined,
    )
    .flatMap(instance => [
      {
        elemID: instance.elemID,
        severity: 'Info',
        message: 'The verified, isPrimary and domainAliases fields are read-only',
        detailedMessage: `Google workspace does not support setting the verified, isPrimary and domainAliases fields trough the API, please set ${instance.value.domainName} fields in the admin console`,
      },
    ])
