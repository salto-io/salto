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
import { values, collections, promises } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { CORE_ANNOTATIONS, Element, isInstanceElement, isType, TypeElement, getField, DetailedChange, isRemovalChange, ElemID, isObjectType, ObjectType, Values, isRemovalOrModificationChange, isAdditionOrModificationChange, isElement, isField, ReadOnlyElementsSource } from '@salto-io/adapter-api'
import { transformElement, TransformFunc, transformValues, applyFunctionToChangeData } from '@salto-io/adapter-utils'
import { mergeElements, MergeResult } from '../merger'
import { State } from './state'
import { createAddChange, createRemoveChange } from './nacl_files/multi_env/projections'
import { ElementsSource } from './elements_source'


const { pickAsync } = promises.object
const { awu } = collections.asynciterable
const log = logger(module)

const hasHiddenValueAnnotation = (element?: Element): boolean =>
  (element?.annotations?.[CORE_ANNOTATIONS.HIDDEN_VALUE] === true)

const isHiddenValue = async (
  element?: Element,
  elementsSource?: ReadOnlyElementsSource,
): Promise<boolean> => (
  hasHiddenValueAnnotation(element)
  || (isField(element) && hasHiddenValueAnnotation(await element.getType(elementsSource)))
)

const isHidden = async (
  element?: Element,
  elementsSource?: ReadOnlyElementsSource,
): Promise<boolean> => (
  element?.annotations?.[CORE_ANNOTATIONS.HIDDEN] === true
  || ((isInstanceElement(element) || isField(element))
    // eslint-disable-next-line no-return-await
    && await isHiddenValue(await element.getType(elementsSource), elementsSource))
)

const getElementHiddenParts = async <T extends Element>(
  stateElement: T,
  elementsSource: ReadOnlyElementsSource,
  workspaceElement?: T,
): Promise<T | undefined> => {
  if (await isHidden(stateElement, elementsSource)) {
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
  const storeHiddenPaths: TransformFunc = async ({ value, field, path }) => {
    if (await hiddenFunc(field, elementsSource)) {
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
  await transformElement({
    element: stateElement,
    transformFunc: storeHiddenPaths,
    strict: false,
    elementsSource,
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

  const hidden = await transformElement({
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
    elementsSource,
  })

  // remove all annotation types from the hidden element so they don't cause merge conflicts
  hidden.annotationRefTypes = {}

  if (isObjectType(hidden) && isObjectType(workspaceElement)) {
    // filter out fields that were deleted in the workspace (unless the field itself is hidden)
    const workspaceFields = new Set(Object.keys(workspaceElement.fields))
    hidden.fields = await pickAsync(
      hidden.fields,
      (field, key) => workspaceFields.has(key) || isHidden(field, elementsSource)
    )
    // Keep field types from the workspace element to avoid merge conflicts
    await awu(Object.values(hidden.fields))
      .filter(async field => !(await isHidden(field, elementsSource)))
      .forEach(field => {
        const workspaceField = workspaceElement.fields[field.name]
        if (!field.refType.elemID.isEqual(workspaceField.refType.elemID)) {
          log.debug(
            'Field type mismatch on %s, overriding state type %s with workspace type %s',
            field.elemID.getFullName(),
            field.refType.elemID.getFullName(),
            workspaceField.refType.elemID.getFullName(),
          )
          field.refType = workspaceField.refType
        }
      })
  }
  return hidden
}

export const mergeWithHidden = async (
  workspaceElements: AsyncIterable<Element>,
  state: ElementsSource,
  partial = false,
  hiddenChangedElemIDs: ElemID[] = []
): Promise<MergeResult> => {
  const hiddenStateElements = partial
    ? awu(hiddenChangedElemIDs).map(id => state.get(id))
    : awu(await state.getAll())
      .filter(async element => isHidden(element, state))
  const workspaceElementsWithHiddenParts = awu(workspaceElements)
    .flatMap(async (elem): Promise<Element[]> => {
      const stateElement = await state.get(elem.elemID)
      return stateElement !== undefined
        ? [elem, await getElementHiddenParts(stateElement, state, elem)]
        : [elem]
    })
    .filter(values.isDefined)
  return mergeElements(
    awu(hiddenStateElements).concat(workspaceElementsWithHiddenParts)
  )
}

const removeHidden = (elementsSource: ReadOnlyElementsSource): TransformFunc =>
  async ({ value, field }) => (
    await isHiddenValue(field, elementsSource) ? undefined : value)

const removeHiddenValue = (elementsSource: ReadOnlyElementsSource): TransformFunc =>
  async ({ value, field }) => (
    await isHiddenValue(field, elementsSource) ? undefined : value)

const removeHiddenFromElement = <T extends Element>(
  element: T,
  elementsSource: ReadOnlyElementsSource,
): Promise<T> => (
    transformElement({
      element,
      transformFunc: isInstanceElement(element)
        ? removeHiddenValue(elementsSource)
        : removeHidden(elementsSource),
      strict: false,
      elementsSource,
    }))

const removeHiddenFromValues = (
  type: ObjectType,
  value: Values,
  pathID: ElemID,
  elementsSource: ReadOnlyElementsSource,
): Promise<Values | undefined> => (
  transformValues({
    values: value,
    type,
    transformFunc: removeHiddenValue(elementsSource),
    pathID,
    elementsSource,
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
  getWorkspaceElements: () => Promise<AsyncIterable<Element>>,
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
  log.info('Handling hidden changes')
  const workspaceElementIds = new Set(
    await awu(await getWorkspaceElements()).map(element => element.elemID.getFullName()).toArray()
  )
  const stateInstances = await state.getAll()
  await awu(stateInstances)
    .filter(element => workspaceElementIds.has(element.elemID.getFullName()))
    .forEach(async element => {
      await transformElement({
        element,
        transformFunc: createHiddenValueChangeIfNeeded,
        strict: true,
        elementsSource: state,
      })
    })

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
  getWorkspaceElements: () => Promise<AsyncIterable<Element>>,
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

const isHiddenField = async (
  baseType: TypeElement,
  fieldPath: ReadonlyArray<string>,
  hiddenValue: boolean,
  elementsSource: ReadOnlyElementsSource,
): Promise<boolean> => {
  const hiddenFunc = hiddenValue ? isHiddenValue : isHidden
  return fieldPath.length === 0
    ? false
    : await hiddenFunc(await getField(baseType, fieldPath, elementsSource), elementsSource)
      || isHiddenField(baseType, fieldPath.slice(0, -1), hiddenValue, elementsSource)
}

const filterOutHiddenChanges = async (
  changes: DetailedChange[],
  state: State,
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

    if ((isType(baseElem) || isInstanceElement(baseElem)) && await isHidden(baseElem, state)) {
      // A change of a hidden type or instance should be omitted completely
      return undefined
    }

    if (isElement(change.data.after)) {
      // Remove nested hidden parts of instances, object types and fields
      return applyFunctionToChangeData(
        change,
        // Should be fetched data?
        element => removeHiddenFromElement(element, state),
      )
    }

    if (isInstanceElement(baseElem)
      || (isObjectType(baseElem) && ['field', 'attr'].includes(change.id.idType))) {
      // Instance values and annotation values in fields and objects can be hidden
      const getChangeTypeAndPath = async (): Promise<{
        changeType: TypeElement
        changePath: ReadonlyArray<string>
      }> => {
        if (isInstanceElement(baseElem)) {
          return {
            changeType: await baseElem.getType(state),
            changePath: path,
          }
        }
        if (change.id.idType === 'attr') {
          return {
            changeType: (await baseElem.getAnnotationTypes(state))[path[0]],
            changePath: path.slice(1),
          }
        }
        // idType === 'field'
        return {
          // changeType will be undefined if the path is too short
          changeType: (await (await baseElem.fields[path[0]].getType(state))
            .getAnnotationTypes(state))[path[1]],
          changePath: path.slice(2),
        }
      }

      const { changeType, changePath } = await getChangeTypeAndPath()
      if (changeType === undefined) {
        // a value without a type cannot be hidden
        return change
      }

      if (await isHiddenValue(changeType, state)) {
        // The change is in a hidden annotation, omit it
        return undefined
      }

      if (await isHiddenField(
        changeType,
        changePath,
        isInstanceElement(baseElem), state
      )) {
        // The change is inside a hidden field value, omit the change
        return undefined
      }

      const fieldType = changeType
        && await (await getField(changeType, changePath, state))?.getType(state)
      if (isObjectType(fieldType)) {
        return applyFunctionToChangeData(
          change,
          value => removeHiddenFromValues(
            fieldType,
            value,
            change.id,
            state,
          ),
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
  getWorkspaceElements: () => Promise<AsyncIterable<Element>>,
): Promise<DetailedChange[]> => {
  const changesWithHiddenAnnotationChanges = await mergeWithHiddenChangeSideEffects(
    changes, state, getWorkspaceElements,
  )
  return filterOutHiddenChanges(changesWithHiddenAnnotationChanges, state)
}
