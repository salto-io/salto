/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { values } from '@salto-io/lowerdash'
import {
  CORE_ANNOTATIONS,
  ChangeDataType,
  DependencyChanger,
  ElemID,
  dependencyChange,
  getChangeData,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { DetailedDependency } from '@salto-io/adapter-utils'
import { isFileInstance } from './types'

const { isDefined } = values

const getFileGeneratedDependenciesToRemove = (element: ChangeDataType): ElemID[] => {
  if (!isFileInstance(element)) {
    return []
  }
  const generatedDependencies: DetailedDependency[] = element.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES] ?? []

  const [parentFolder] = element.annotations[CORE_ANNOTATIONS.PARENT] ?? []
  const parentFolderElemId = isReferenceExpression(parentFolder) ? parentFolder.elemID.createBaseID().parent : undefined

  return generatedDependencies
    .map(({ reference }) => reference.elemID.createBaseID().parent)
    .filter(elemId => !parentFolderElemId?.isEqual(elemId))
}

const dependencyChanger: DependencyChanger = async changesMap => {
  const changesWithIds = Array.from(changesMap.entries()).map(([id, change]) => ({ change, id }))

  const elemIdToChangeId = new Map(
    changesWithIds.map(({ change, id }) => [getChangeData(change).elemID.getFullName(), id]),
  )

  return changesWithIds.flatMap(({ change, id: sourceId }) =>
    getFileGeneratedDependenciesToRemove(getChangeData(change))
      .map(elemId => elemIdToChangeId.get(elemId.getFullName()))
      .filter(isDefined)
      .map(targetId => dependencyChange('remove', sourceId, targetId)),
  )
}

export default dependencyChanger
