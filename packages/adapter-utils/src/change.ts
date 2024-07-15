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
  Change,
  DetailedChange,
  isAdditionOrModificationChange,
  isRemovalOrModificationChange,
  toChange,
} from '@salto-io/adapter-api'

const hasElemIDs = <T extends Change | DetailedChange>(change: T): change is T & Pick<DetailedChange, 'elemIDs'> =>
  'elemIDs' in change

export const reverseChange = <T extends Change | DetailedChange>(change: T): T => {
  const before = isAdditionOrModificationChange(change) ? change.data.after : undefined
  const after = isRemovalOrModificationChange(change) ? change.data.before : undefined
  const reversedElemIDs =
    hasElemIDs(change) && change.elemIDs !== undefined
      ? { elemIDs: { before: change.elemIDs.after, after: change.elemIDs.before } }
      : {}

  return {
    ...change,
    ...toChange({ before, after }),
    ...reversedElemIDs,
  }
}
