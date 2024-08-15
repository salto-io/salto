/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { isInstanceChange, isRemovalOrModificationChange } from '@salto-io/adapter-api'
import { IS_SUB_INSTANCE } from '../constants'
import { NetsuiteChangeValidator } from './types'

const changeValidator: NetsuiteChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .map(change => (isRemovalOrModificationChange(change) ? change.data.before : change.data.after))
    .filter(instance => instance.value[IS_SUB_INSTANCE])
    .map(({ elemID }) => ({
      elemID,
      severity: 'Error',
      message: "Can't deploy changes to some elements",
      detailedMessage: "Can't deploy changes to this element because it’s not a deployable instance.",
    }))

export default changeValidator
