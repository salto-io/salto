/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ChangeValidator, getChangeData, isInstanceElement, isModificationChange } from '@salto-io/adapter-api'
import { LOCALE_TYPE_NAME } from '../constants'

export const localeModificationValidator: ChangeValidator = async changes =>
  changes
    .filter(isModificationChange)
    .map(getChangeData)
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === LOCALE_TYPE_NAME)
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Error',
      message: 'Modification of locale is not supported',
      detailedMessage: `Failed to update ${instance.elemID.getFullName()} since modification of locale is not supported by Zendesk`,
    }))
