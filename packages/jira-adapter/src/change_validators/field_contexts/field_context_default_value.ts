/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ChangeError,
  ChangeValidator,
  ElemID,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceChange,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { getParent } from '@salto-io/adapter-utils'
import { values } from '@salto-io/lowerdash'
import { JiraConfig } from '../../config/config'
import { FIELD_CONTEXT_TYPE_NAME } from '../../filters/fields/constants'

const getError = (contextElemId: ElemID): ChangeError => ({
  elemID: contextElemId,
  severity: 'Error',
  message: "Default value's references are not valid",
  detailedMessage: 'The context default value option must reference the parent of the default cascading option',
})
/**
 * Verify that the context's default optionId is the parent of the default cascading optionId.
 */
export const fieldContextDefaultValueValidator: (config: JiraConfig) => ChangeValidator = config => async changes => {
  if (!config.fetch.splitFieldContextOptions) {
    return []
  }
  return changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .filter(change => getChangeData(change).elemID.typeName === FIELD_CONTEXT_TYPE_NAME)
    .map(getChangeData)
    .map(contextInstance => {
      const defaultCascadingOptionIdRef = contextInstance.value.defaultValue?.cascadingOptionId
      if (!isReferenceExpression(defaultCascadingOptionIdRef)) {
        return undefined
      }
      const cascadingParent = getParent(defaultCascadingOptionIdRef.value)
      const defaultOptionIdRef = contextInstance.value.defaultValue.optionId
      if (!isReferenceExpression(defaultOptionIdRef) || !defaultOptionIdRef.elemID.isEqual(cascadingParent.elemID)) {
        return getError(contextInstance.elemID)
      }
      return undefined
    })
    .filter(values.isDefined)
}
