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
import {
  CORE_ANNOTATIONS, Element,
  isInstanceElement, isType,
  TypeElement,
  getField,
  DetailedChange,
  isRemovalChange,
  ElemID,
  isObjectType,
  ObjectType,
  Values,
  isRemovalOrModificationChange,
  isAdditionOrModificationChange,
  isElement,
} from '@salto-io/adapter-api'
import { transformElement, TransformFunc, transformValues, applyFunctionToChangeData } from '@salto-io/adapter-utils'
import { mergeElements, MergeResult } from '../merger'
import { State } from './state'
import { createAddChange, createRemoveChange } from './nacl_files/multi_env/projections'

const isHidden = (element?: Element): boolean => (
  element?.annotations?.[CORE_ANNOTATIONS.HIDDEN] === true
)

const splitElementHiddenParts = <T extends Element>(
  element: T,
): { hidden?: T; visible?: T } => {
  if (isHidden(element)) {
    // The whole element is hidden
    return { hidden: element }
  }

  const hiddenPaths: string[] = []
  const removeHiddenAndStorePath: TransformFunc = ({ value, field, path }) => {
    if (isHidden(field)) {
      if (path !== undefined) {
        hiddenPaths.push(path.getFullName())
      }
      return undefined
    }
    return value
  }
  const visible = transformElement({
    element,
    transformFunc: removeHiddenAndStorePath,
    strict: false,
  })

  if (hiddenPaths.length === 0) {
    // The whole element is visible
    return { visible: element }
  }

  const isPartOfHiddenPath = (path?: ElemID): boolean => (
    // Something is considered a part of a hidden path if it is a prefix of a hidden path
    // or if it is nested inside a hidden path.
    // Assume A.B.C is a hidden path, when we transform the element we must not omit A.B
    // because then we'd never reach A.B.C
    // We also do not omit A.B.C.D because A.B.C was hidden, so by association everything inside
    // it is also hidden
    path !== undefined && hiddenPaths.some(hiddenPath => (
      hiddenPath.startsWith(path.getFullName()) || path.getFullName().startsWith(hiddenPath)
    ))
  )

  const hidden = transformElement({
    element,
    transformFunc: ({ value, path }) => (isPartOfHiddenPath(path) ? value : undefined),
    strict: true,
  })
  return { hidden, visible }
}

export const mergeWithHidden = (
  workspaceElements: ReadonlyArray<Element>,
  stateElements: ReadonlyArray<Element>,
): MergeResult => {
  const workspaceElemIds = new Set(workspaceElements.map(e => e.elemID.getFullName()))
  const hiddenElements = stateElements
    .filter(elem => isHidden(elem) || workspaceElemIds.has(elem.elemID.getFullName()))
    .map(elem => splitElementHiddenParts(elem).hidden)
    .filter(values.isDefined)

  return mergeElements([...workspaceElements, ...hiddenElements])
}

const removeHiddenValue: TransformFunc = ({ value, field }) => (
  isHidden(field) ? undefined : value
)

const removeHiddenFromElement = <T extends Element>(element: T): Element => (
  transformElement({
    element,
    transformFunc: removeHiddenValue,
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
  })
)

const isChangeToHidden = (change: DetailedChange): boolean => (
  isAdditionOrModificationChange(change) && change.data.after === true
)

const isChangeToNotHidden = (change: DetailedChange): boolean => (
  isRemovalOrModificationChange(change) && change.data.before === true
)

const isHiddenChangeOnElement = (change: DetailedChange): boolean => (
  change.id.idType === 'attr'
  && change.id.nestingLevel === 1
  && change.id.name === CORE_ANNOTATIONS.HIDDEN
  && (isChangeToHidden(change) || isChangeToNotHidden(change))
)

const isHiddenChangeOnField = (change: DetailedChange): boolean => (
  change.id.idType === 'field'
  && change.id.nestingLevel === 2
  && change.id.name === CORE_ANNOTATIONS.HIDDEN
  && (isChangeToHidden(change) || isChangeToNotHidden(change))
)

const getHiddenTypeChanges = async (
  changes: DetailedChange[],
  state: State,
): Promise<DetailedChange[]> => (
  (await Promise.all(
    changes
      .filter(isHiddenChangeOnElement)
      .map(async change => {
        const elemId = change.id.createTopLevelParentID().parent
        const elem = await state.get(elemId)
        if (!isElement(elem)) {
          // Should never happen
          return change
        }
        return isChangeToHidden(change)
          ? createRemoveChange(elem, elemId)
          : createAddChange(elem, elemId)
      })
  )).filter(values.isDefined)
)

const getHiddenFieldValueChanges = async (
  changes: DetailedChange[],
  state: State,
  getWorkspaceElements: () => Promise<Element[]>,
): Promise<DetailedChange[]> => {
  const hiddenFieldChanges = changes.filter(isHiddenChangeOnField)
  if (hiddenFieldChanges.length === 0) {
    // This should be to common case where there are no changes to the hidden annotation
    return []
  }

  const [hideFieldChanges, unHideFieldChanges] = _.partition(hiddenFieldChanges, isChangeToHidden)
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

  // When a field becomes hidden, all the values of that field need to be removed
  // When a field is made visible, all the values of that field need to be added
  // In order to support making a field visible we must traverse all state elements
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
  // its value is included in the first one. a change in "unique" if there are no changes
  // to ids that contain it
  const hasChangeContainingId = (id: ElemID): boolean => (
    changeById[id.getFullName()] !== undefined
    || (!id.isTopLevel() && hasChangeContainingId(id.createParentID()))
  )
  return Object.values(changeById)
    .filter(change => change.id.isTopLevel() || !hasChangeContainingId(change.id.createParentID()))
}

const handleChangesToHiddenAnnotation = async (
  changes: DetailedChange[],
  state: State,
  getWorkspaceElements: () => Promise<Element[]>,
): Promise<DetailedChange[]> => {
  const additionalChanges = [
    ...await getHiddenTypeChanges(changes, state),
    ...await getHiddenFieldValueChanges(changes, state, getWorkspaceElements),
  ]
  return additionalChanges.length === 0
    ? changes
    : removeDuplicateChanges(changes, additionalChanges)
}

const isHiddenField = (baseType: TypeElement, fieldPath: ReadonlyArray<string>): boolean => (
  fieldPath.length === 0
    ? false
    : isHidden(getField(baseType, fieldPath))
      || isHiddenField(baseType, fieldPath.slice(0, -1))
)

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

    if (isType(baseElem) && isHidden(baseElem)) {
      // A change of a hidden type should be omitted completely
      return undefined
    }

    if (isInstanceElement(baseElem) || (isObjectType(baseElem) && change.id.idType === 'attr')) {
      // Instance values and annotation values can be hidden
      const [changeType, valuePath] = isInstanceElement(baseElem)
        ? [baseElem.type, path]
        : [baseElem.annotationTypes[path[0]], path.slice(1)]

      if (changeType === undefined) {
        // a value without a type cannot be hidden
        return change
      }

      if (isHiddenField(changeType, valuePath)) {
        // The change is inside a hidden field value, omit the change
        return undefined
      }
      // The change subject is not hidden, but it might contain hidden parts
      if (isInstanceElement(change.data.after)) {
        return applyFunctionToChangeData(change, removeHiddenFromElement)
      }
      const fieldType = changeType && getField(changeType, valuePath)?.type
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
  const changesWithHiddenAnnotationChanges = await handleChangesToHiddenAnnotation(
    changes, state, getWorkspaceElements,
  )
  return filterOutHiddenChanges(changesWithHiddenAnnotationChanges, state)
}
