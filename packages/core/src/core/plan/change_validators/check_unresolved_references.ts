/*
*                      Copyright 2023 Salto Labs Ltd.
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

import { Change, ChangeValidator, getChangeData, isModificationChange, isRemovalChange } from '@salto-io/adapter-api'
import { UnresolvedElemIDs } from '@salto-io/workspace'

const getChangeType = (change: Change): string => {
  if (isModificationChange(change)) {
    return 'modified'
  }
  if (isRemovalChange(change)) {
    return 'deleted'
  }
  throw Error('Unexpected type?')
}

export const checkUnresolvedReferencesValidator = (unresolvedElemIDs: UnresolvedElemIDs)
  : ChangeValidator => async changes => (
  changes
    .filter(change => unresolvedElemIDs.missing.some(
      unresolvedElemID => getChangeData(change).elemID.isEqual(unresolvedElemID)
    ))
    .map(change => {
      const { elemID } = getChangeData(change)
      const changeType = getChangeType(change)
      return {
        elemID,
        severity: 'Warning',
        message: `Unresolved references to a ${changeType} element.`,
        detailedMessage: `Some elements contain references to this ${changeType} element, which are no longer valid.`
            + ' You may continue with deploying this change, but the deployment might fail.',
      }
    })
)
