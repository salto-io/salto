/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { isRemovalChange, getChangeData } from '@salto-io/adapter-api'
import { isStandardTypeName } from '../autogen/types'
import { isStandardInstanceOrCustomRecordType } from '../types'
import { NetsuiteChangeValidator } from './types'

const changeValidator: NetsuiteChangeValidator = async changes =>
  changes
    .filter(isRemovalChange)
    .map(getChangeData)
    .filter(isStandardInstanceOrCustomRecordType)
    .map(({ elemID }) => ({
      elemID,
      severity: 'Error',
      message: "Can't remove elements without the Salto SuiteApp configured",
      detailedMessage: `Removal of ${isStandardTypeName(elemID.typeName) ? 'standard' : 'custom record'} type ${elemID.idType}s is only supported. Contact us to configure Salto SuiteApp`,
    }))

export default changeValidator
