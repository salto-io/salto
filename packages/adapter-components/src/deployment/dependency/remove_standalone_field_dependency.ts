/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import wu from 'wu'
import {
  getChangeData,
  DependencyChanger,
  dependencyChange,
  isReferenceExpression,
  ChangeId,
} from '@salto-io/adapter-api'
import { getParents } from '@salto-io/adapter-utils'

export const removeStandaloneFieldDependency: DependencyChanger = async (changes, deps) => {
  const isDependencyFromParentToChild = ([src, target]: [ChangeId, ChangeId]): boolean => {
    const sourceChange = changes.get(src)
    const targetChange = changes.get(target)
    if (sourceChange === undefined || targetChange === undefined) {
      return false
    }
    return (
      getParents(getChangeData(targetChange)).find(
        e => isReferenceExpression(e) && e.elemID.isEqual(getChangeData(sourceChange).elemID),
      ) != null
    )
  }

  const allDependencies = wu(deps)
    .map(([source, targets]) =>
      wu(targets)
        .filter(target => deps.get(target)?.has(source) === true)
        .map(target => [source, target]),
    )
    .flatten(true)

  return allDependencies
    .filter(isDependencyFromParentToChild)
    .map(([source, target]) => dependencyChange('remove', source, target))
}
