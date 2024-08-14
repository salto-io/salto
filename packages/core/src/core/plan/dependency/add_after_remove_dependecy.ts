/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import wu from 'wu'
import { collections } from '@salto-io/lowerdash'
import {
  getChangeData,
  DependencyChanger,
  ChangeEntry,
  DependencyChange,
  dependencyChange,
} from '@salto-io/adapter-api'

export const addAfterRemoveDependency: DependencyChanger = async changes => {
  const removeChanges = collections.iterable.groupBy(
    wu(changes).filter(([_id, change]) => change.action === 'remove'),
    ([_id, change]) => getChangeData(change).elemID.getFullName(),
  )

  const addChangeDependency = ([id, change]: ChangeEntry): DependencyChange[] =>
    (removeChanges.get(getChangeData(change).elemID.getFullName()) ?? []).map(([removeChangeId]) =>
      dependencyChange('add', id, removeChangeId),
    )

  return wu(changes)
    .filter(([_id, change]) => change.action === 'add')
    .map(addChangeDependency)
    .flatten()
}
