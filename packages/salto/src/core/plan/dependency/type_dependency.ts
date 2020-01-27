import wu from 'wu'
import { collections } from '@salto/lowerdash'
import { Field, InstanceElement, isType, getChangeElement } from 'adapter-api'
import {
  ChangeEntry, isFieldChange, isInstanceChange, DependencyProvider, DependencyChange,
  addReferenceDependency,
} from './common'


type FieldOrInstanceChange = ChangeEntry<Field | InstanceElement>
const isFieldOrInstanceChange = (entry: ChangeEntry): entry is FieldOrInstanceChange => (
  isFieldChange(entry) || isInstanceChange(entry)
)

export const typeDependencyProvider: DependencyProvider = async changes => {
  const typeChanges = collections.map.groupBy(
    wu(changes).filter(([_id, change]) => isType(getChangeElement(change))),
    ([_id, change]) => getChangeElement(change).elemID.getFullName(),
  )

  const addTypeDependency = ([id, change]: FieldOrInstanceChange): DependencyChange[] => (
    (typeChanges.get(getChangeElement(change).type.elemID.getFullName()) ?? [])
      .filter(([_id, typeChange]) => typeChange.action === change.action)
      .map(([typeChangeId]) => addReferenceDependency(change.action, id, typeChangeId))
  )

  return wu(changes)
    .filter(isFieldOrInstanceChange)
    .map(change => addTypeDependency(change as FieldOrInstanceChange))
    .flatten()
}
