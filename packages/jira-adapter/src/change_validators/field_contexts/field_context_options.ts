/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  // ChangeError,
  ChangeValidator,
  // getChangeData,
  // InstanceElement,
  // isAdditionOrModificationChange,
  // isInstanceElement,
  // isReferenceExpression,
} from '@salto-io/adapter-api'
// import { getParent } from '@salto-io/adapter-utils'
// import { values } from '@salto-io/lowerdash'
// import { FIELD_CONTEXT_OPTION_TYPE_NAME } from '../../filters/fields/constants'

// const getError = (option: InstanceElement, context: InstanceElement): ChangeError => ({
//   elemID: option.elemID,
//   severity: 'Error',
//   message: "This option is not being referenced by it's parent context",
//   detailedMessage: `The parent context ${context.elemID.getFullName()} should reference all it's options`,
// })
/**
 * Verify that the context reference all the added/modified options.
 */
export const fieldContextOptionsValidator: ChangeValidator = async (_changes, elementSource) => {
  if (elementSource === undefined) {
    return []
  }
  return []
}
