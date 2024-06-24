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

import { getChangeData, isInstanceElement } from '@salto-io/adapter-api'
import { deployment } from '@salto-io/adapter-components'
import { getParents } from '@salto-io/adapter-utils'

/**
 * Set the group ID of an element to be its parent's full name if it has a parent.
 * Some of the elements are top-level, but can only be deployed as part of their parent (using a dedicated filter).
 * There's an assumption here that the parent is always a top-level element + its change group is simply its full name.
 */
export const groupChangeWithItsParent: deployment.grouping.ChangeIdFunction = async change => {
  const changeData = getChangeData(change)
  const changeFullName = changeData.elemID.getFullName()

  if (!isInstanceElement(changeData)) {
    return changeFullName
  }

  const parentRefs = getParents(changeData)
  return parentRefs[0]?.elemID.getFullName() ?? changeFullName
}
