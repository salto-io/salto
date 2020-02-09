import wu from 'wu'
import { collections } from '@salto/lowerdash'
import {
  Element, getChangeElement, transform, isInstanceElement, TransformValueFunc,
  isReferenceExpression, isField, BuiltinTypes, TypeMap, INSTANCE_ANNOTATIONS,
  CORE_ANNOTATIONS,
} from 'adapter-api'
import {
  DependencyChanger, ChangeEntry, DependencyChange, addReferenceDependency,
} from './common'

const getAnnotationTypes = (element: Element): TypeMap => {
  // Actual type doesn't really matter here, we just need the annotations to be defined
  const builtinAnnotations: TypeMap = Object.assign(
    {} as TypeMap,
    ...[...Object.values(INSTANCE_ANNOTATIONS), ...Object.values(CORE_ANNOTATIONS)]
      .map(key => ({ [key]: BuiltinTypes.STRING })),
  )
  const elementAnnotations = isInstanceElement(element) || isField(element)
    ? element.type.annotationTypes
    : element.annotationTypes
  return Object.assign(builtinAnnotations, elementAnnotations)
}

const getAllReferencedIds = (elem: Element): Set<string> => {
  const allReferencedIds = new Set<string>()
  const transformCallback: TransformValueFunc = val => {
    if (isReferenceExpression(val)) {
      allReferencedIds.add(val.elemId.getFullName())
    }
    return val
  }

  if (isInstanceElement(elem)) {
    transform(elem.value, elem.type, transformCallback)
  }
  transform(elem.annotations, getAnnotationTypes(elem), transformCallback)
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
