import wu from 'wu'
import { collections } from '@salto/lowerdash'
import { Field, InstanceElement, isType, getChangeElement } from 'adapter-api'
import {
  ChangeEntry, isFieldChange, isInstanceChange, DependencyChanger, DependencyChange,
  addReferenceDependency,
} from './common'


type FieldOrInstanceChange = ChangeEntry<Field | InstanceElement>
const isFieldOrInstanceChange = (entry: ChangeEntry): entry is FieldOrInstanceChange => (
  isFieldChange(entry) || isInstanceChange(entry)
)

export const addTypeDependency: DependencyChanger = async changes => {
  const typeChanges = collections.iterable.groupBy(
    wu(changes).filter(([_id, change]) => isType(getChangeElement(change))),
    ([_id, change]) => getChangeElement(change).elemID.getFullName(),
  )

  const addChangeTypeDependency = ([id, change]: FieldOrInstanceChange): DependencyChange[] => (
    (typeChanges.get(getChangeElement(change).type.elemID.getFullName()) ?? [])
      .filter(([_id, typeChange]) => typeChange.action === change.action)
      .map(([typeChangeId]) => addReferenceDependency(change.action, id, typeChangeId))
  )

  return wu(changes)
    .filter(isFieldOrInstanceChange)
    .map(addChangeTypeDependency)
    .flatten()
}
