/*
 *                      Copyright 2024 Salto Labs Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
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
export const fieldContextDefaultValueValidator: (config: JiraConfig) => ChangeValidator = config => async changes =>
  config.fetch.splitFieldContextOptions
    ? changes
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
          if (
            !isReferenceExpression(defaultOptionIdRef) ||
            !defaultOptionIdRef.elemID.isEqual(cascadingParent.elemID)
          ) {
            return getError(contextInstance.elemID)
          }
          return undefined
        })
        .filter(values.isDefined)
    : []
