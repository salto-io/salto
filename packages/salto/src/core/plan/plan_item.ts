import _ from 'lodash'
import wu from 'wu'

import { RemovalDiff, ModificationDiff, AdditionDiff, NodeId, Group } from '@salto/dag'
import {
  ChangeDataType, Values, Value, ElemID, Change, isEqualElements, isEqualValues, getChangeElement,
  Element, isPrimitiveType, ObjectType, PrimitiveType, isObjectType, isField, isInstanceElement,
} from 'adapter-api'
import { getOrCreateGroupLevelChange, findGroupLevelChange } from './group'

export type DetailedChange<T = ChangeDataType | Values | Value> =
  (AdditionDiff<T> | ModificationDiff<T> | RemovalDiff<T>) & {
    id: ElemID
    path?: string[]
  }

export type PlanItemId = NodeId
export type PlanItem = Group<Change> & {
  parent: () => Change
  changes: () => Iterable<Change>
  detailedChanges: () => Iterable<DetailedChange>
  getElementName: () => string
}

/**
 * Create detailed changes from change data (before and after values)
 */
const getValuesChanges = (id: ElemID, before: Value, after: Value): DetailedChange[] => {
  if (isEqualElements(before, after) || isEqualValues(before, after)) {
    return []
  }
  if (before === undefined) {
    return [{ id, action: 'add', data: { after } }]
  }
  if (after === undefined) {
    return [{ id, action: 'remove', data: { before } }]
  }
  if (_.isPlainObject(before) && _.isPlainObject(after)) {
    return _(before).keys()
      .union(_.keys(after))
      .map(key => getValuesChanges(id.createNestedID(key), before[key], after[key]))
      .flatten()
      .value()
  }
  if (_.isArray(before) && _.isArray(after)) {
    // If there is an addition or deletion in the list we treat the whole list as changed
    // This is because we cannot serialize addition / deletion from a list properly
    if (before.length === after.length) {
      return _.flatten(
        _.times(before.length).map(
          i => getValuesChanges(id.createNestedID(i.toString()), before[i], after[i])
        )
      )
    }
  }
  return [{ id, action: 'modify', data: { before, after } }]
}

export const addPlanItemAccessors = (
  group: Group<Change>,
  beforeElementsMap: Record<NodeId, Element>,
  afterElementsMap: Record<NodeId, Element>,
): PlanItem => Object.assign(group, {
  parent() {
    return getOrCreateGroupLevelChange(group, beforeElementsMap, afterElementsMap)
  },
  changes() {
    return group.items.values()
  },
  detailedChanges() {
    const hasAnnotationTypeChange = (change: ModificationDiff<ChangeDataType>): boolean => {
      const hasAnnotationTypes = (elem: ChangeDataType): elem is ObjectType | PrimitiveType =>
        isObjectType(elem) || isPrimitiveType(elem)
      if (hasAnnotationTypes(change.data.before) && hasAnnotationTypes(change.data.after)) {
        return !change.data.before.isAnnotationsTypesEqual(change.data.after)
      }
      return false
    }

    // If we have a change in the annotation type we will mark the entire element as changed
    // due to: SALTO-333
    const topLevelChange = findGroupLevelChange(group)
    if (topLevelChange && topLevelChange.action === 'modify'
      && hasAnnotationTypeChange(topLevelChange)) {
      return [{ ...topLevelChange, id: topLevelChange.data.after.elemID }]
    }

    return wu(group.items.values())
      .map(change => {
        const elem = getChangeElement(change)
        if (change.action !== 'modify') {
          return { ...change, id: elem.elemID }
        }

        // A special case to handle isList changes in fields.
        // should only happen if we misidentified the type
        // in fetch. See SALTO-322
        if (isField(change.data.before)
          && isField(change.data.after)
          && change.data.after.isList !== change.data.before.isList) {
          return { ...change, id: elem.elemID }
        }

        if (isInstanceElement(change.data.before) && isInstanceElement(change.data.after)) {
          return getValuesChanges(elem.elemID, change.data.before.value, change.data.after.value)
        }

        return getValuesChanges(
          elem.elemID.isTopLevel() ? elem.elemID.createNestedID('attr') : elem.elemID,
          change.data.before.annotations, change.data.after.annotations
        )
      })
      .flatten()
  },
  getElementName() {
    return getChangeElement(this.parent()).elemID.getFullName()
  },
})
