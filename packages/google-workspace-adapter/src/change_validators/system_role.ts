/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ChangeValidator, getChangeData, isInstanceElement } from '@salto-io/adapter-api'
import { ROLE_TYPE_NAME } from '../constants'

//  Google support predefined roles that are managed by Google and can not be edited.

export const systemRoleValidator: ChangeValidator = async changes =>
  changes
    .map(getChangeData)
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === ROLE_TYPE_NAME)
    .filter(instance => instance.value.isSystemRole === true)
    .flatMap(instance => [
      {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Can not edit system roles trough the API',
        detailedMessage: 'Can not edit system roles trough the API',
      },
    ])
