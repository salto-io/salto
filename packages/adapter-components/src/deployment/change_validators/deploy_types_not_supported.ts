/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ChangeValidator, getChangeData, isObjectType } from '@salto-io/adapter-api'

export const deployTypesNotSupportedValidator: ChangeValidator = async changes =>
  changes
    .map(getChangeData)
    .filter(isObjectType)
    .map(objectType => ({
      elemID: objectType.elemID,
      severity: 'Error',
      message: `Deployment of non-instance elements is not supported in adapter ${objectType.elemID.adapter}`,
      detailedMessage: `Deployment of non-instance elements is not supported in adapter ${objectType.elemID.adapter}. Please see your business app FAQ at https://help.salto.io/en/articles/6927118-supported-business-applications for a list of supported elements.`,
    }))
