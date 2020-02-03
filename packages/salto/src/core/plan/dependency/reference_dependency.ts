import wu from 'wu'
import { collections } from '@salto/lowerdash'
import { Element, getChangeElement, transform, isInstanceElement, TransformValueFunc, isReferenceExpression } from 'adapter-api'
import {
  DependencyChanger, ChangeEntry, DependencyChange, addReferenceDependency,
} from './common'

const getAllReferencedIds = (elem: Element): Set<string> => {
  const allReferencedIds = new Set<string>()
  const transformCallback: TransformValueFunc = val => {
    if (isReferenceExpression(val)) {
      allReferencedIds.add(val.elemId.getFullName())
    }
    return val
  }

  if (isInstanceElement(elem)) {
    transform(elem.value, elem.type, transformCallback, false)
  }
  transform(elem.annotations, elem.annotationTypes, transformCallback, false)
  return allReferencedIds
}

export const addReferencesDependency: DependencyChanger = async changes => {
  const changesById = collections.iterable.groupBy(
    wu(changes),
    ([_id, change]) => getChangeElement(change).elemID.getFullName(),
  )

  const addChangeDependency = ([id, change]: ChangeEntry): Iterable<DependencyChange> => (
    (wu(getAllReferencedIds(getChangeElement(change)))
      .map(referencedId => changesById.get(referencedId) ?? [])
      .flatten(true) as wu.WuIterable<ChangeEntry>)
      .filter(([_id, referencedChange]) => referencedChange.action === change.action)
      .map(([referencedChangeId]) => addReferenceDependency(change.action, id, referencedChangeId))
  )

  return wu(changes).map(addChangeDependency).flatten()
}
