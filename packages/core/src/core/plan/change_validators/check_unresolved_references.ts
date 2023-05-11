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

import { ChangeValidator, getChangeData } from '@salto-io/adapter-api'
import { UnresolvedElemIDs } from '@salto-io/workspace'

export const checkUnresolvedReferencesValidator = (unresolvedElemIDs: UnresolvedElemIDs)
  : ChangeValidator => async changes => (
  unresolvedElemIDs.missing
    .filter(unresolvedElemID => changes.some(change => getChangeData(change).elemID.isEqual(unresolvedElemID)))
    .map(elemID => ({
      elemID,
      severity: 'Warning',
      message: 'Unresolved references to a modified/deleted element.',
      detailedMessage: '(The change to this element/Removing this element) created unresolved references in X other elements. If this was done on purpose, you may continue.',
    }))
)
