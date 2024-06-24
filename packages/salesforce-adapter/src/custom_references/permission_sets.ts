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

import { ReferenceInfo, Element, InstanceElement } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { PERMISSION_SET_METADATA_TYPE } from '../constants'
import { isInstanceOfTypeSync } from '../filters/utils'
import { WeakReferencesHandler } from '../types'
import { mapProfileOrPermissionSetSections } from './profiles'

const log = logger(module)
const { makeArray } = collections.array

const referencesFromPermissionSets = (
  permissionSet: InstanceElement,
): ReferenceInfo[] =>
  mapProfileOrPermissionSetSections(
    permissionSet,
    (sectionName, sectionEntryKey, target, sourceField) => ({
      source: permissionSet.elemID.createNestedID(
        sectionName,
        sectionEntryKey,
        ...makeArray(sourceField),
      ),
      target,
      type: 'weak',
    }),
  )

const findWeakReferences: WeakReferencesHandler['findWeakReferences'] = async (
  elements: Element[],
): Promise<ReferenceInfo[]> => {
  const permissionSets = elements.filter(
    isInstanceOfTypeSync(PERMISSION_SET_METADATA_TYPE),
  )
  const refs = log.timeDebug(
    () => permissionSets.flatMap(referencesFromPermissionSets),
    `Generating references from ${permissionSets.length} permission sets.`,
  )
  log.debug(
    'Generated %d references for %d elements.',
    refs.length,
    elements.length,
  )
  return refs
}

export const permissionSetsHandler: WeakReferencesHandler = {
  findWeakReferences,
  removeWeakReferences: () => async () => ({ fixedElements: [], errors: [] }),
}
