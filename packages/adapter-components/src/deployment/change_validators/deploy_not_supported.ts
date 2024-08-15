/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { ChangeValidator, getChangeData } from '@salto-io/adapter-api'

export const deployNotSupportedValidator: ChangeValidator = async changes =>
  changes.map(change => ({
    elemID: getChangeData(change).elemID,
    severity: 'Error',
    message: `Salto does not support ${getChangeData(change).elemID.adapter} deployments.`,
    detailedMessage: `Salto does not support ${getChangeData(change).elemID.adapter} deployments. Please see https://help.salto.io/en/articles/6927118-supported-business-applications for more details.`,
  }))
