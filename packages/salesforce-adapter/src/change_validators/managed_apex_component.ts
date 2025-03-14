/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ChangeError, ChangeValidator, getChangeData, InstanceElement, isInstanceChange } from '@salto-io/adapter-api'
import { apiNameSync } from '../filters/utils'

const HIDDEN_CONTENT = '(hidden)'

const isInstanceWithHiddenContent = (instance: InstanceElement): boolean => instance.value.content === HIDDEN_CONTENT

const changeValidator: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(isInstanceWithHiddenContent)
    .map<ChangeError>(instance => ({
      elemID: instance.elemID,
      severity: 'Error',
      message: 'Cannot deploy changes to a managed Apex Component.',
      detailedMessage: `The ${apiNameSync(instance.getTypeSync())} ${apiNameSync(instance)} is not modifiable.`,
    }))

export default changeValidator
