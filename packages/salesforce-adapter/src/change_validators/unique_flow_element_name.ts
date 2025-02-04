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
import { TransformFuncSync, transformValuesSync } from '@salto-io/adapter-utils'
import { apiNameSync, isInstanceOfTypeSync } from '../filters/utils'
import { FLOW_ELEMENTS_WITH_UNIQUE_NAMES, FLOW_METADATA_TYPE } from '../constants'

const { DefaultMap } = collections.map

const createChangeErrors = (element: InstanceElement): ChangeError[] => {
  const duplicates = new Set<string>()
  const nameToElemIds = new DefaultMap<string, ElemID[]>(() => [])
  const mapNameToElemIds: TransformFuncSync = ({ value, path, field }) => {
    if (
      field === undefined ||
      path === undefined ||
      !FLOW_ELEMENTS_WITH_UNIQUE_NAMES.includes(apiNameSync(field.parent) ?? '') ||
      path.name !== 'name'
    )
      return value
    if (nameToElemIds.get(value).length > 0) {
      duplicates.add(value)
    }
    nameToElemIds.get(value).push(path)
    return value
  }
  transformValuesSync({
    values: element.value,
    pathID: element.elemID,
    type: element.getTypeSync(),
    transformFunc: mapNameToElemIds,
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
