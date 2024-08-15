/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { isRemovalChange, getChangeData } from '@salto-io/adapter-api'
import { isFileCabinetInstance } from '../types'
import { NetsuiteChangeValidator } from './types'

const changeValidator: NetsuiteChangeValidator = async changes =>
  changes
    .filter(isRemovalChange)
    .map(getChangeData)
    .filter(isFileCabinetInstance)
    .map(({ elemID }) => ({
      elemID,
      severity: 'Error',
      message: "Can't remove file cabinet files and folders because the Salto SuiteApp is not installed",
      detailedMessage:
        "Can't remove this element because the Salto SuiteApp is not installed. In order to remove file cabinet files or folders, install the Salto SuiteApp, as instructed here: https://docs.salto.io/docs/netsuite#setup-instructions",
    }))

export default changeValidator
