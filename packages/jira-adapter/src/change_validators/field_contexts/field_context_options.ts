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
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceElement,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { getParent } from '@salto-io/adapter-utils'
import { values } from '@salto-io/lowerdash'
import { FIELD_CONTEXT_OPTION_TYPE_NAME } from '../../filters/fields/constants'

const getError = (option: InstanceElement, context: InstanceElement): ChangeError => ({
  elemID: option.elemID,
  severity: 'Error',
  message: "This option is not being referenced by it's parent context",
  detailedMessage: `The parent context ${context.elemID.getFullName()} should reference all it's options`,
})
/**
 * Verify that the context reference all the added/modified options.
 */
export const fieldContextOptionsValidator: ChangeValidator = async (changes, elementSource) => {
  if (elementSource === undefined) {
    return []
  }
  const options = changes
    .filter(change => getChangeData(change).elemID.typeName === FIELD_CONTEXT_OPTION_TYPE_NAME)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isInstanceElement)

  return (
    await Promise.all(
      options.map(async option => {
        const context = await elementSource.get(getParent(option).elemID)
        if (!isInstanceElement(context)) {
          return undefined
        }
        const contextOptions = context.value.options
        if (!Array.isArray(contextOptions)) {
          return getError(option, context)
        }
        const contextOptionsElemIDs = contextOptions.filter(isReferenceExpression).map(opt => opt.elemID.getFullName())
        if (!contextOptionsElemIDs.includes(option.elemID.getFullName())) {
          return getError(option, context)
        }
        return undefined
      }),
    )
  ).filter(values.isDefined)
}
