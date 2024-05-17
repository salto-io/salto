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

import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { Element, InstanceElement, ReferenceInfo } from '@salto-io/adapter-api'
import { WeakReferencesHandler } from '../types'
import { PROFILE_METADATA_TYPE } from '../constants'
import { isInstanceOfTypeSync } from '../filters/utils'
import {
  mapProfileOrPermissionSetSections,
  removeWeakReferencesFromProfilesOrPermissionSets,
} from './profile_permission_set_utils'

const { makeArray } = collections.array
const log = logger(module)

const referencesFromProfile = (profile: InstanceElement): ReferenceInfo[] =>
  mapProfileOrPermissionSetSections(
    profile,
    (sectionName, sectionEntryKey, target, sourceField) => ({
      source: profile.elemID.createNestedID(
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
  const profiles = elements.filter(isInstanceOfTypeSync(PROFILE_METADATA_TYPE))
  const refs = log.timeDebug(
    () => profiles.flatMap(referencesFromProfile),
    `Generating references from ${profiles.length} profiles.`,
  )
  log.debug(
    'Generated %d references for %d elements.',
    refs.length,
    elements.length,
  )
  return refs
}

const removeWeakReferences: WeakReferencesHandler['removeWeakReferences'] =
  ({ elementsSource }) =>
  async (elements) => {
    const profiles = elements.filter(
      isInstanceOfTypeSync(PROFILE_METADATA_TYPE),
    )

    return removeWeakReferencesFromProfilesOrPermissionSets(
      profiles,
      elementsSource,
    )
  }

export const profilesHandler: WeakReferencesHandler = {
  findWeakReferences,
  removeWeakReferences,
}
