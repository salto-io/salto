/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ReferenceInfo, Element, InstanceElement } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { MUTING_PERMISSION_SET_METADATA_TYPE, PERMISSION_SET_METADATA_TYPE } from '../constants'
import { isInstanceOfTypeSync } from '../filters/utils'
import { WeakReferencesHandler } from '../types'
import { mapProfileOrPermissionSetSections } from './profiles'

const log = logger(module)
const { makeArray } = collections.array

const isPermissionSet = isInstanceOfTypeSync(PERMISSION_SET_METADATA_TYPE, MUTING_PERMISSION_SET_METADATA_TYPE)

const referencesFromPermissionSets = (permissionSet: InstanceElement): ReferenceInfo[] =>
  mapProfileOrPermissionSetSections(permissionSet, (sectionName, sectionEntryKey, target, sourceField) => ({
    source: permissionSet.elemID.createNestedID(sectionName, sectionEntryKey, ...makeArray(sourceField)),
    target,
    type: 'weak',
  }))

const findWeakReferences: WeakReferencesHandler['findWeakReferences'] = async (
  elements: Element[],
): Promise<ReferenceInfo[]> => {
  const permissionSets = elements.filter(isPermissionSet)
  const refs = log.timeDebug(
    () => permissionSets.flatMap(referencesFromPermissionSets),
    `Generating references from ${permissionSets.length} permission sets.`,
  )
  log.debug('Generated %d references for %d elements.', refs.length, elements.length)
  return refs
}

export const permissionSetsHandler: WeakReferencesHandler = {
  findWeakReferences,
  removeWeakReferences: () => async () => ({ fixedElements: [], errors: [] }),
}
