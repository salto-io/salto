import wu from 'wu'
import { collections } from '@salto/lowerdash'
import { getChangeElement } from 'adapter-api'
import {
  DependencyChanger, ChangeEntry, DependencyChange, dependencyChange,
} from './common'

export const addAfterRemoveDependency: DependencyChanger = async changes => {
  const removeChanges = collections.iterable.groupBy(
    wu(changes).filter(([_id, change]) => change.action === 'remove'),
    ([_id, change]) => getChangeElement(change).elemID.getFullName(),
  )

  const addChangeDependency = ([id, change]: ChangeEntry): DependencyChange[] => (
    (removeChanges.get(getChangeElement(change).elemID.getFullName()) ?? [])
      .map(([removeChangeId]) => dependencyChange('add', id, removeChangeId))
  )

  return wu(changes)
    .filter(([_id, change]) => change.action === 'add')
    .map(addChangeDependency)
    .flatten()
}
