/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ChangeError,
  ChangeValidator,
  ElemID,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { WALK_NEXT_STEP, walkOnElement, WalkOnFunc } from '@salto-io/adapter-utils'
import { isInstanceOfTypeSync } from '../filters/utils'
import { FLOW_METADATA_TYPE } from '../constants'

const { DefaultMap } = collections.map

const createChangeErrors = (element: InstanceElement): ChangeError[] => {
  const duplicates = new Set<string>()
  const nameToElemIds = new DefaultMap<string, ElemID[]>(() => [])
  const mapNameToElemIds: WalkOnFunc = ({ value, path }) => {
    if (path === undefined || path.name !== 'name') return WALK_NEXT_STEP.RECURSE
    if (nameToElemIds.get(value).length > 0) {
      duplicates.add(value)
    }
    nameToElemIds.get(value).push(path)
    return WALK_NEXT_STEP.RECURSE
  }
  walkOnElement({
    element,
    func: mapNameToElemIds,
  })
  return Array.from(duplicates).flatMap(name =>
    nameToElemIds.get(name).map(elemId => ({
      elemID: elemId,
      severity: 'Warning',
      message: 'Duplicate Name in Flow',
      detailedMessage: `The name "${name}" is used multiple times in this Flow.`,
    })),
  )
}

const changeValidator: ChangeValidator = async changes =>
  changes
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isInstanceOfTypeSync(FLOW_METADATA_TYPE))
    .flatMap(createChangeErrors)

export default changeValidator
