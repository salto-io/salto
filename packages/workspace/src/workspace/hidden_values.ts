/*
*                      Copyright 2020 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import _ from 'lodash'
import { values } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import {
  CORE_ANNOTATIONS, Element, isInstanceElement, isType, TypeElement, getField, DetailedChange,
  isRemovalChange, ElemID, isObjectType, ObjectType, Values, isRemovalOrModificationChange,
  isAdditionOrModificationChange, isElement, isField,
} from '@salto-io/adapter-api'
import { transformElement, TransformFunc, transformValues, applyFunctionToChangeData } from '@salto-io/adapter-utils'
import { mergeElements, MergeResult } from '../merger'
import { State } from './state'
import { createAddChange, createRemoveChange } from './nacl_files/multi_env/projections'

const log = logger(module)

const isHiddenValue = (element?: Element): boolean => (
  element?.annotations?.[CORE_ANNOTATIONS.HIDDEN_VALUE] === true
)

const isHidden = (element?: Element): boolean => (
  element?.annotations?.[CORE_ANNOTATIONS.HIDDEN] === true
  || ((isInstanceElement(element) || isField(element)) && isHiddenValue(element.type))
)

const getElementHiddenParts = <T extends Element>(
  stateElement: T,
  workspaceElement?: T,
): T | undefined => {
  if (isHidden(stateElement)) {
    // The whole element is hidden
    return stateElement
  }

  const hiddenPaths = new Set<string>()
  const ancestorsOfHiddenPaths = new Set<string>()

  // There are two "hidden" annotations - _hidden, and _hidden_value.
  // If this is an instance, the field belongs to the type so we want to check if
  // the field is marked as _hidden_value.
  // Otherwise, we're looking for either a _hidden annotation on the element,
  // or a _hidden_value annotation on its type definition.
  const hiddenFunc = isInstanceElement(stateElement) ? isHiddenValue : isHidden
  const storeHiddenPaths: TransformFunc = ({ value, field, path }) => {
    if (hiddenFunc(field)) {
      if (path !== undefined) {
        hiddenPaths.add(path.getFullName())
        let ancestor = path.createParentID()
        while (!ancestorsOfHiddenPaths.has(ancestor.getFullName())) {
          ancestorsOfHiddenPaths.add(ancestor.getFullName())
          ancestor = ancestor.createParentID()
        }
      }
      return undefined
    }
    return value
  }
  transformElement({
    element: stateElement,
    transformFunc: storeHiddenPaths,
    strict: false,
  })

  if (hiddenPaths.size === 0) {
    // The whole element is visible
    return undefined
  }

  const isAncestorOfHiddenPath = (path: ElemID): boolean => (
    ancestorsOfHiddenPaths.has(path.getFullName())
  )

  let lastHiddenPath: ElemID | undefined
  const isNestedHiddenPath = (path: ElemID): boolean => {
    if (lastHiddenPath?.isParentOf(path)) {
      return true
    }
    if (hiddenPaths.has(path.getFullName())) {
      lastHiddenPath = path
      return true
    }
    lastHiddenPath = undefined
    return false
  }

  const hidden = transformElement({
    element: stateElement,
    transformFunc: ({ value, path }) => (
      // Keep traversing as long as we might reach nested hidden parts.
      // Note: it is ok to check isAncestorOfHiddenPath before isNestedHiddenPath, because there is
      // no overlap between ancestorsOfHiddenPaths and hiddenPaths
      path !== undefined && (isAncestorOfHiddenPath(path) || isNestedHiddenPath(path))
        ? value
        : undefined
    ),
    strict: true,
  })
  // remove all annotation types from the hidden element so they don't cause merge conflicts
  hidden.annotationTypes = {}

  if (isObjectType(hidden) && isObjectType(workspaceElement)) {
    // filter out fields that were deleted in the workspace (unless the field itself is hidden)
    const workspaceFields = new Set(Object.keys(workspaceElement.fields))
    hidden.fields = _.pickBy(
      hidden.fields,
      (field, key) => workspaceFields.has(key) || isHidden(field)
    )
    // Keep field types from the workspace element to avoid merge conflicts
    Object.values(hidden.fields)
      .filter(field => !isHidden(field))
      .forEach(field => {
        const workspaceField = workspaceElement.fields[field.name]
        if (!field.type.elemID.isEqual(workspaceField.type.elemID)) {
          log.debug(
            'Field type mismatch on %s, overriding state type %s with workspace type %s',
            field.elemID.getFullName(),
            field.type.elemID.getFullName(),
            workspaceField.type.elemID.getFullName(),
          )
          field.type = workspaceField.type
        }
      })
  }
  return hidden
}

export const mergeWithHidden = (
  workspaceElements: ReadonlyArray<Element>,
  stateElements: ReadonlyArray<Element>,
): MergeResult => {
  const workspaceElementsMap = _.keyBy(workspaceElements, e => e.elemID.getFullName())
  const hiddenElements = stateElements
    .filter(elem => isHidden(elem) || workspaceElementsMap[elem.elemID.getFullName()] !== undefined)
    .map(elem => (
      getElementHiddenParts(elem, workspaceElementsMap[elem.elemID.getFullName()])
    ))
    .filter(values.isDefined)

  return mergeElements([...workspaceElements, ...hiddenElements])
}

const removeHidden: TransformFunc = ({ value, field }) => (
  isHidden(field) ? undefined : value
)

const removeHiddenValue: TransformFunc = ({ value, field }) => (
  isHiddenValue(field) ? undefined : value
)

const removeHiddenFromElement = <T extends Element>(element: T): T => (
  transformElement({
    element,
    transformFunc: isInstanceElement(element) ? removeHiddenValue : removeHidden,
    strict: false,
  })
)

const removeHiddenFromValues = (
  type: ObjectType, value: Values, pathID: ElemID
): Values | undefined => (
  transformValues({
    values: value,
    type,
    transformFunc: removeHiddenValue,
    pathID,
    strict: false,
  })
)

const isChangeToHidden = (change: DetailedChange, hiddenValue: boolean): boolean => (
  change.id.name === (hiddenValue ? CORE_ANNOTATIONS.HIDDEN_VALUE : CORE_ANNOTATIONS.HIDDEN)
  && isAdditionOrModificationChange(change) && change.data.after === true
)

const isChangeToNotHidden = (change: DetailedChange, hiddenValue: boolean): boolean => (
  change.id.name === (hiddenValue ? CORE_ANNOTATIONS.HIDDEN_VALUE : CORE_ANNOTATIONS.HIDDEN)
  && isRemovalOrModificationChange(change) && change.data.before === true
)
const isHiddenChangeOnElement = (change: DetailedChange, hiddenValue: boolean): boolean => (
  change.id.idType === 'attr'
  && change.id.nestingLevel === 1
  && (isChangeToHidden(change, hiddenValue) || isChangeToNotHidden(change, hiddenValue))
)

const isHiddenChangeOnField = (change: DetailedChange): boolean => (
  change.id.idType === 'field'
  && change.id.nestingLevel === 2
  && (isChangeToHidden(change, true) || isChangeToNotHidden(change, true))
)

/**
 * When a type changes from/to hidden, we need to create a change that adds/removes
 * the whole type to the nacl instead of just changing the hidden annotation value.
 */
const getHiddenTypeChanges = async (
  changes: DetailedChange[],
  state: State,
): Promise<DetailedChange[]> => (
  (await Promise.all(
    changes
      .filter(c => isHiddenChangeOnElement(c, false))
      .map(async change => {
        const elemId = change.id.createTopLevelParentID().parent
        const elem = await state.get(elemId)
        if (!isElement(elem)) {
          // Should never happen
          log.warn(
            'Element %s was changed to hidden %s but was not found in state',
            elemId.getFullName(), isChangeToHidden(change, false),
          )
          return change
        }
        return isChangeToHidden(change, false)
          ? createRemoveChange(elem, elemId)
          : createAddChange(elem, elemId)
      })
  )).filter(values.isDefined)
)

/**
 * When a field or annotation changes from/to hidden, we need to create changes that add/remove
 * the values of that field in all relevant instances / annotation values
 */
const getHiddenFieldAndAnnotationValueChanges = async (
  changes: DetailedChange[],
  state: State,
  getWorkspaceElements: () => Promise<Element[]>,
): Promise<DetailedChange[]> => {
  // TODO hide fields marked with _hidden=true

  const hiddenFieldChanges = changes.filter(
    c => isHiddenChangeOnField(c) || isHiddenChangeOnElement(c, true)
  )
  if (hiddenFieldChanges.length === 0) {
    // This should be the common case where there are no changes to the hidden annotation
    return []
  }

  const [hideFieldChanges, unHideFieldChanges] = _.partition(
    hiddenFieldChanges,
    c => isChangeToHidden(c, true),
  )
  const hideFieldIds = new Set(
    hideFieldChanges.map(change => change.id.createParentID().getFullName())
  )
  const unHideFieldIds = new Set(
    unHideFieldChanges.map(change => change.id.createParentID().getFullName())
  )

  const hiddenValueChanges: DetailedChange[] = []
  const createHiddenValueChangeIfNeeded: TransformFunc = ({ value, field, path }) => {
    if (path === undefined || field === undefined) {
      return value
    }
    const fieldId = field.elemID.getFullName()
    if (hideFieldIds.has(fieldId)) {
      hiddenValueChanges.push(createRemoveChange(value, path))
      return undefined
    }
    if (unHideFieldIds.has(fieldId)) {
      hiddenValueChanges.push(createAddChange(value, path))
      return undefined
    }
    return value
  }

  // In order to support making a field/annotation visible we must traverse all state elements
  // to find all the hidden values we need to add.
  // Theoretically in order to hide values we would need to iterate the workspace elements
  // but since we assume a redundant remove change is handled gracefully, we optimize this
  // by only iterating the state elements and creating remove changes for values that are
  // newly hidden, some of these remove changes may be redundant (if the value we
  // are trying to hide was already removed manually from the workspace element)
  const workspaceElementIds = new Set(
    (await getWorkspaceElements()).map(element => element.elemID.getFullName())
  )
  const stateInstances = await state.getAll()
  stateInstances
    .filter(element => workspaceElementIds.has(element.elemID.getFullName()))
    .forEach(element => transformElement({
      element,
      transformFunc: createHiddenValueChangeIfNeeded,
      strict: true,
    }))

  return hiddenValueChanges
}

const removeDuplicateChanges = (
  origChanges: DetailedChange[],
  additionalChanges: DetailedChange[],
): DetailedChange[] => {
  const changes = [...origChanges, ...additionalChanges]
  // If we have multiple changes on the same ID, we want to take the newer change
  // (the one from additionalChanges) because it overrides the original, for example
  // this can happen if a field is both hidden and changed at the same time
  const changeById = _.keyBy(changes, change => change.id.getFullName())

  // If we have a change to A.B and a change to A.B.C, the second change is redundant because
  // its value is included in the first one.
  const hasChangeOnParent = (id: ElemID): boolean => {
    if (id.isTopLevel()) {
      return false
    }
    const parent = id.createParentID()
    return changeById[parent.getFullName()] !== undefined || hasChangeOnParent(parent)
  }

  return Object.values(changeById).filter(change => !hasChangeOnParent(change.id))
}

/**
 * This handles the cases where something changes from hidden to visible or vice-versa.
 * Since the hidden annotation is currently supported on types and fields, we need to handle
 * types that changed visibility and fields that changed visibility.
 */
const mergeWithHiddenChangeSideEffects = async (
  changes: DetailedChange[],
  state: State,
  getWorkspaceElements: () => Promise<Element[]>,
): Promise<DetailedChange[]> => {
  const additionalChanges = [
    ...await getHiddenTypeChanges(changes, state),
    ...await getHiddenFieldAndAnnotationValueChanges(changes, state, getWorkspaceElements),
  ]
  // Additional changes may override / be overridden by original changes, so if we add new changes
  // we have to make sure we remove duplicates
  return additionalChanges.length === 0
    ? changes
    : removeDuplicateChanges(changes, additionalChanges)
}

const isHiddenField = (
  baseType: TypeElement,
  fieldPath: ReadonlyArray<string>,
  hiddenValue: boolean,
): boolean => {
  const hiddenFunc = hiddenValue ? isHiddenValue : isHidden
  return fieldPath.length === 0
    ? false
    : hiddenFunc(getField(baseType, fieldPath))
      || isHiddenField(baseType, fieldPath.slice(0, -1), hiddenValue)
}

const filterOutHiddenChanges = async (
  changes: DetailedChange[],
  state: State
): Promise<DetailedChange[]> => {
  const filterOutHidden = async (change: DetailedChange): Promise<DetailedChange | undefined> => {
    if (isRemovalChange(change)) {
      // There should be no harm in letting remove changes through here. remove should be resilient
      // to its subject not existing
      return change
    }

    const { parent, path } = change.id.createTopLevelParentID()
    const baseElem = change.id.isTopLevel() ? change.data.after : await state.get(parent)

    if (baseElem === undefined) {
      // If something is not in the state it cannot be hidden
      return change
    }

    if ((isType(baseElem) || isInstanceElement(baseElem)) && isHidden(baseElem)) {
      // A change of a hidden type or instance should be omitted completely
      return undefined
    }

    if (isElement(change.data.after)) {
      // Remove nested hidden parts of instances, object types and fields
      return applyFunctionToChangeData(change, removeHiddenFromElement)
    }

    if (isInstanceElement(baseElem)
      || (isObjectType(baseElem) && ['field', 'attr'].includes(change.id.idType))) {
      // Instance values and annotation values in fields and objects can be hidden
      const getChangeTypeAndPath = (): {
        changeType: TypeElement
        changePath: ReadonlyArray<string>
      } => {
        if (isInstanceElement(baseElem)) {
          return {
            changeType: baseElem.type,
            changePath: path,
          }
        }
        if (change.id.idType === 'attr') {
          return {
            changeType: baseElem.annotationTypes[path[0]],
            changePath: path.slice(1),
          }
        }
        // idType === 'field'
        return {
          // changeType will be undefined if the path is too short
          changeType: baseElem.fields[path[0]].type.annotationTypes[path[1]],
          changePath: path.slice(2),
        }
      }

      const { changeType, changePath } = getChangeTypeAndPath()
      if (changeType === undefined) {
        // a value without a type cannot be hidden
        return change
      }

      if (isHiddenValue(changeType)) {
        // The change is in a hidden annotation, omit it
        return undefined
      }

      if (isHiddenField(changeType, changePath, isInstanceElement(baseElem))) {
        // The change is inside a hidden field value, omit the change
        return undefined
      }

      const fieldType = changeType && getField(changeType, changePath)?.type
      if (isObjectType(fieldType)) {
        return applyFunctionToChangeData(
          change,
          value => removeHiddenFromValues(fieldType, value, change.id)
        )
      }
    }

    return change
  }

  return (await Promise.all(changes.map(filterOutHidden))).filter(values.isDefined)
}

export const handleHiddenChanges = async (
  changes: DetailedChange[],
  state: State,
  getWorkspaceElements: () => Promise<Element[]>,
): Promise<DetailedChange[]> => {
  const changesWithHiddenAnnotationChanges = await mergeWithHiddenChangeSideEffects(
    changes, state, getWorkspaceElements,
  )
  return filterOutHiddenChanges(changesWithHiddenAnnotationChanges, state)
}
