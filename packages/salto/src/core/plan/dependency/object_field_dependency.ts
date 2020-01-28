import wu from 'wu'
import { collections } from '@salto/lowerdash'
import { getChangeElement, Field } from 'adapter-api'
import {
  DependencyProvider, isObjectTypeChange, ChangeEntry, DependencyChange, addReferenceDependency,
  isFieldChange,
} from './common'

export const objectDependencyProvider: DependencyProvider = async changes => {
  const objectChanges = collections.iterable.groupBy(
    wu(changes).filter(isObjectTypeChange),
    ([_id, change]) => getChangeElement(change).elemID.getFullName(),
  )

  const addObjectDependency = ([id, change]: ChangeEntry<Field>): DependencyChange[] => (
    (objectChanges.get(getChangeElement(change).parentID.getFullName()) ?? [])
      .filter(([_id, objectChange]) => objectChange.action === change.action)
      .map(([objectChangeId]) => addReferenceDependency(change.action, id, objectChangeId))
  )

  return wu(changes)
    .filter(isFieldChange)
    .map(addObjectDependency)
    .flatten()
}
