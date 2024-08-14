/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { isInstanceElement, getChangeData } from '@salto-io/adapter-api'
import { isStandardInstanceOrCustomRecordType } from '../types'
import { NetsuiteChangeValidator } from './types'

const changeValidator: NetsuiteChangeValidator = async changes =>
  changes
    .map(getChangeData)
    .filter(elem => !isInstanceElement(elem) && !isStandardInstanceOrCustomRecordType(elem))
    .map(({ elemID }) => ({
      elemID,
      severity: 'Error',
      message: "Can't deploy changes to type definitions",
      detailedMessage:
        "Can't deploy changes to this element because it's a type definition. Type definitions are read-only.",
    }))

export default changeValidator
