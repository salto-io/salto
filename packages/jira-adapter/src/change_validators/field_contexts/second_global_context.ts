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
  CORE_ANNOTATIONS,
  ElemID,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isAdditionOrModificationChange,
  isInstanceChange,
  SeverityLevel,
} from '@salto-io/adapter-api'
import { getInstancesFromElementSource, getParentElemID } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { FIELD_CONTEXT_TYPE_NAME } from '../../filters/fields/constants'
import { isGlobalContext } from '../../common/fields'
import { InstanceAddModifyChange } from '../../common/general'

const log = logger(module)

const createFieldContextErrorMessage = (elemID: ElemID, field: InstanceElement): ChangeError => ({
  elemID,
  severity: 'Error' as SeverityLevel,
  message: 'A field can only have a single global context',
  detailedMessage: `Can't deploy this global context because the deployment will result in more than a single global context for field ${field.annotations[CORE_ANNOTATIONS.ALIAS] ?? field.elemID.name}.`,
})

export const fieldSecondGlobalContextValidator: ChangeValidator = async (changes, elementSource) => {
  if (elementSource === undefined) {
    log.error('Failed to run fieldSecondGlobalContextValidator because element source is undefined')
    return []
  }

  const contextChanges = changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .filter(change => getChangeData(change).elemID.typeName === FIELD_CONTEXT_TYPE_NAME) as InstanceAddModifyChange[]

  if (contextChanges.length === 0) {
    return []
  }
  const fieldToGlobalContextCount = _.countBy(
    (await getInstancesFromElementSource(elementSource, [FIELD_CONTEXT_TYPE_NAME])).filter(isGlobalContext),
    instance => getParentElemID(instance).getFullName(),
  )

  const addedGlobalContext = (change: InstanceAddModifyChange): boolean =>
    isGlobalContext(change.data.after) && (isAdditionChange(change) || !isGlobalContext(change.data.before))

  return Promise.all(
    contextChanges
      .filter(addedGlobalContext)
      .map(getChangeData)
      .filter(instance => fieldToGlobalContextCount[getParentElemID(instance).getFullName()] > 1)
      .map(async instance =>
        createFieldContextErrorMessage(instance.elemID, await elementSource.get(getParentElemID(instance))),
      ),
  )
}
