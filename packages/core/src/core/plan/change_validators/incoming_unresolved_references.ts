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
  ChangeValidator,
  ModificationChange,
  RemovalChange,
  SaltoError,
  getChangeData,
  isModificationChange,
  isRemovalOrModificationChange,
} from '@salto-io/adapter-api'
import { validator } from '@salto-io/workspace'

const { isUnresolvedRefError } = validator

const getChangeType = <T>(change: ModificationChange<T> | RemovalChange<T>): string =>
  isModificationChange(change) ? 'modified' : 'deleted'

export const incomingUnresolvedReferencesValidator =
  (validationErrors: ReadonlyArray<SaltoError>): ChangeValidator =>
  async changes => {
    const unresolvedErrors = validationErrors.filter(isUnresolvedRefError)
    return changes
      .filter(isRemovalOrModificationChange)
      .flatMap(change => {
        const { elemID } = getChangeData(change)
        const group = unresolvedErrors.filter(({ target }) => elemID.isEqual(target) || elemID.isParentOf(target))
        return group.length === 0 ? [] : [{ change, group }]
      })
      .map(({ change, group }) => {
        const changeType = getChangeType(change)
        const { elemID } = getChangeData(change)
        return {
          elemID,
          severity: 'Warning',
          message: `Some elements contain references to this ${changeType} element`,
          detailedMessage:
            `${group.length} other elements contain references to this ${changeType} element, which are no longer valid.` +
            ' You may continue with deploying this change, but the deployment might fail.',
        }
      })
  }
