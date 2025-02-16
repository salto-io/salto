/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { values, collections, promises } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import {
  transformElement,
  TransformFunc,
  transformValues,
  applyFunctionToChangeData,
  elementAnnotationTypes,
  safeJsonStringify,
  resolvePath,
  getDetailedChanges,
  detailedCompare,
  setPath,
} from '@salto-io/adapter-utils'
import {
  CORE_ANNOTATIONS,
  Element,
  isInstanceElement,
  isType,
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
  isField,
  ReadOnlyElementsSource,
  ReferenceMap,
  isPrimitiveType,
  PrimitiveType,
  InstanceElement,
  Field,
  isModificationChange,
  ModificationChange,
  ReferenceExpression,
  MapType,
  getFieldType,
  isMapType,
  isTypeReference,
  DetailedChangeWithBaseChange,
  toChange,
  isAdditionChange,
  isFieldChange,
  isIndexPathPart,
} from '@salto-io/adapter-api'
import { mergeElements, MergeResult } from '../merger'
import { State } from './state'
import { ElementsSource } from './elements_source'
import { splitElementByPath } from './path_index'

const { pickAsync } = promises.object
const { awu } = collections.asynciterable
const log = logger(module)

const isHiddenValue = (element?: Element): boolean => element?.annotations?.[CORE_ANNOTATIONS.HIDDEN_VALUE] === true

export const isHidden = async (element?: Element, elementsSource?: ReadOnlyElementsSource): Promise<boolean> =>
  element?.annotations?.[CORE_ANNOTATIONS.HIDDEN] === true ||
  ((isInstanceElement(element) || isField(element)) && isHiddenValue(await element.getType(elementsSource)))

export const getElementHiddenParts = async <T extends Element>(
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
  const storeHiddenPaths: TransformFunc = async ({ value, field, path }) => {
    if (isHiddenValue(field)) {
      if (path !== undefined) {
        const parentPath = path.createParentID()
        if (!parentPath.isBaseID() && workspaceElement !== undefined) {
          const workspaceValue = resolvePath(workspaceElement, parentPath)
          // If the parent value is not an object, (e.g., deleted or replaced with a primitive),
          // we don't want to merge hidden values from state
          if (!_.isPlainObject(workspaceValue)) {
            return undefined
          }
        }
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

  const isAncestorOfHiddenPath = (path: ElemID): boolean => ancestorsOfHiddenPaths.has(path.getFullName())

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
    transformFunc: ({ value, path }) =>
      // Keep traversing as long as we might reach nested hidden parts.
      // Note: it is ok to check isAncestorOfHiddenPath before isNestedHiddenPath, because there is
      // no overlap between ancestorsOfHiddenPaths and hiddenPaths
      path !== undefined && (isAncestorOfHiddenPath(path) || isNestedHiddenPath(path)) ? value : undefined,
    strict: true,
    allowEmptyArrays: true,
    allowAllEmptyObjects: true,
    elementsSource,
  })
  // remove all annotation types from the hidden element so they don't cause merge conflicts
  hidden.annotationRefTypes = {}
  if (isObjectType(hidden) && isObjectType(workspaceElement)) {
    // filter out fields that were deleted in the workspace (unless the field itself is hidden)
    const workspaceFields = new Set(Object.keys(workspaceElement.fields))
    hidden.fields = await pickAsync(
      hidden.fields,
      (field, key) => workspaceFields.has(key) || isHidden(field, elementsSource),
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
  hiddenChangedElemIDs: ElemID[] = [],
): Promise<MergeResult> => {
  const hiddenStateElements = partial
    ? awu(hiddenChangedElemIDs).map(id => state.get(id))
    : awu(await state.getAll()).filter(element => isHidden(element, state))
  const workspaceElementsWithHiddenParts = awu(workspaceElements)
    .flatMap(async (elem): Promise<Element[]> => {
      const stateElement = await state.get(elem.elemID)
      return stateElement !== undefined ? [elem, await getElementHiddenParts(stateElement, state, elem)] : [elem]
    })
    .filter(values.isDefined)
  return mergeElements(awu(hiddenStateElements).concat(workspaceElementsWithHiddenParts))
}

// Check if the given path is nested in a list
const isPathInList = (path: ElemID | undefined): boolean => path?.getFullNameParts().some(isIndexPathPart) ?? false

const removeHiddenValue: TransformFunc = ({ value, field, path }) => {
  if (!isHiddenValue(field)) {
    return value
  }
  if (isPathInList(path)) {
    log.warn(
      'Cannot remove hidden value of %s when nested in a list (full path: %s)',
      field?.elemID.getFullName(),
      path?.getFullName(),
    )
    return value
  }
  return undefined
}

export const removeHiddenFromElement = <T extends Element>(
  element: T,
  elementsSource: ReadOnlyElementsSource,
): Promise<T> =>
  transformElement({
    element,
    transformFunc: removeHiddenValue,
    strict: false,
    elementsSource,
    allowEmptyArrays: true,
    allowAllEmptyObjects: true,
  })

const removeHiddenFromValues = (
  type: ObjectType | MapType,
  value: Values,
  pathID: ElemID,
  elementsSource: ReadOnlyElementsSource,
): Promise<Values | undefined> =>
  transformValues({
    values: value,
    type,
    transformFunc: removeHiddenValue,
    pathID,
    elementsSource,
    strict: false,
    allowEmptyArrays: true,
    allowAllEmptyObjects: true,
  })

const isAttributeChangeToHidden = (change: DetailedChange, hiddenValue: boolean): boolean =>
  change.id.name === (hiddenValue ? CORE_ANNOTATIONS.HIDDEN_VALUE : CORE_ANNOTATIONS.HIDDEN) &&
  isAdditionOrModificationChange(change) &&
  change.data.after === true

const isAttributeChangeToNotHidden = (change: DetailedChange, hiddenValue: boolean): boolean =>
  change.id.name === (hiddenValue ? CORE_ANNOTATIONS.HIDDEN_VALUE : CORE_ANNOTATIONS.HIDDEN) &&
  isRemovalOrModificationChange(change) &&
  change.data.before === true

const isFieldAdditionWithHiddenValue = (change: DetailedChange): boolean =>
  isFieldChange(change) &&
  isAdditionChange(change) &&
  change.data.after?.annotations?.[CORE_ANNOTATIONS.HIDDEN_VALUE] === true

const isFieldRemovalWithHiddenValue = (change: DetailedChange): boolean =>
  isFieldChange(change) &&
  isRemovalChange(change) &&
  change.data.before?.annotations?.[CORE_ANNOTATIONS.HIDDEN_VALUE] === true

const isHiddenAttributeChange = (change: DetailedChange, hiddenValue: boolean): boolean =>
  change.id.idType === 'attr' &&
  change.id.nestingLevel === 1 &&
  (isAttributeChangeToHidden(change, hiddenValue) || isAttributeChangeToNotHidden(change, hiddenValue))

const isFieldModificationChangeToHiddenValue = (change: DetailedChange): boolean =>
  isFieldChange(change) &&
  isModificationChange(change) &&
  change.data.before?.annotations?.[CORE_ANNOTATIONS.HIDDEN_VALUE] !== false &&
  change.data.after?.annotations?.[CORE_ANNOTATIONS.HIDDEN_VALUE] === true

const isFieldModificationChangeToNotHiddenValue = (change: DetailedChange): boolean =>
  isFieldChange(change) &&
  isModificationChange(change) &&
  change.data.before?.annotations?.[CORE_ANNOTATIONS.HIDDEN_VALUE] === true &&
  change.data.after?.annotations?.[CORE_ANNOTATIONS.HIDDEN_VALUE] !== false

const isFieldModificationWithHiddenValue = (change: DetailedChange): boolean =>
  (change.id.idType === 'field' &&
    change.id.nestingLevel === 2 &&
    (isAttributeChangeToHidden(change, true) || isAttributeChangeToNotHidden(change, true))) ||
  isFieldModificationChangeToHiddenValue(change) ||
  isFieldModificationChangeToNotHiddenValue(change)

const isHiddenChangeOnField = (change: DetailedChange): boolean =>
  isFieldModificationWithHiddenValue(change) ||
  isFieldAdditionWithHiddenValue(change) ||
  isFieldRemovalWithHiddenValue(change)

const isTopLevelModificationWithHiddenChange = <T>(
  change: DetailedChange<T>,
): change is DetailedChange<T & Element> & ModificationChange<T & Element> =>
  change.id.isTopLevel() &&
  change.action === 'modify' &&
  !!(change.data.before as Element).annotations?.[CORE_ANNOTATIONS.HIDDEN] !==
    !!(change.data.after as Element).annotations?.[CORE_ANNOTATIONS.HIDDEN]

const isTopLevelModificationAfterHidden = <T extends Element>(
  change: DetailedChange<T> & ModificationChange<T>,
): boolean => !!(change.data.after as Element).annotations?.[CORE_ANNOTATIONS.HIDDEN]

/**
 * When a type changes from/to hidden, we need to create a change that adds/removes
 * the whole type to the nacl instead of just changing the hidden annotation value.
 */
const getHiddenTypeChanges = async (
  changes: DetailedChangeWithBaseChange[],
  state: State,
): Promise<DetailedChangeWithBaseChange[]> =>
  awu(changes)
    .filter(change => isTopLevelModificationWithHiddenChange(change) || isHiddenAttributeChange(change, false))
    .flatMap(async change => {
      const elemId = change.id.createTopLevelParentID().parent
      const elem = await state.get(elemId)
      if (!isElement(elem)) {
        // Should never happen
        log.warn(
          'Element %s was changed to hidden %s but was not found in state',
          elemId.getFullName(),
          isAttributeChangeToHidden(change, false),
        )
        return [change]
      }

      const changeToHidden = isTopLevelModificationWithHiddenChange(change)
        ? isTopLevelModificationAfterHidden(change)
        : isAttributeChangeToHidden(change, false)
      const baseChange = changeToHidden ? toChange({ before: elem }) : toChange({ after: elem })
      return getDetailedChanges(baseChange)
    })
    .toArray()

const getInstanceTypeHiddenChanges = async (
  changes: DetailedChange[],
  state: State,
): Promise<DetailedChangeWithBaseChange[]> => {
  const hiddenValueOnElementChanges = changes.filter(c => isHiddenAttributeChange(c, true))

  // Exit early to avoid unneeded calculation if there are no hidden type changes
  if (hiddenValueOnElementChanges.length === 0) {
    return []
  }

  const [toHiddenChanges, fromHiddenChanges] = _.partition(hiddenValueOnElementChanges, c =>
    isAttributeChangeToHidden(c, true),
  )

  const toHiddenElemIds = new Set(
    toHiddenChanges.map(change => change.id.createTopLevelParentID().parent.getFullName()),
  )

  const fromHiddenElemIds = new Set(
    fromHiddenChanges.map(change => change.id.createTopLevelParentID().parent.getFullName()),
  )

  const pathIndex = await state.getPathIndex()
  const r = await awu(await state.getAll())
    .flatMap(async elem => {
      if (isInstanceElement(elem)) {
        if (toHiddenElemIds.has(elem.refType.elemID.getFullName())) {
          return getDetailedChanges(toChange({ before: elem }))
        }
        if (fromHiddenElemIds.has(elem.refType.elemID.getFullName())) {
          return (await splitElementByPath(elem, pathIndex)).flatMap(fragment =>
            getDetailedChanges(toChange({ after: fragment })).map(change => ({ ...change, path: fragment.path })),
          )
        }
      }
      return []
    })
    .toArray()
  return r
}

const isAnnotationTypeChange = (
  change: DetailedChangeWithBaseChange,
): change is DetailedChangeWithBaseChange & ModificationChange<ReferenceExpression> =>
  isModificationChange(change) &&
  change.id.isAnnotationTypeID() &&
  isTypeReference(change.data.before) &&
  isTypeReference(change.data.after)

type EffectOnHidden = 'hide' | 'unhide' | 'none'
const getTypeChangeEffectOnHidden =
  (state: State, hideTypeIds: Set<string>, unhideTypeIds: Set<string>) =>
  async (change: DetailedChange & ModificationChange<ReferenceExpression>): Promise<EffectOnHidden> => {
    const { before, after } = change.data as ModificationChange<ReferenceExpression>['data']
    const [beforeType, afterType] = await Promise.all([before.getResolvedValue(state), after.getResolvedValue(state)])
    if (!isType(beforeType) || !isType(afterType)) {
      // Should never happen
      log.warn(
        'type change on %s, one of the type IDs did not resolve to a type element. before: %s (isType=%s). after: %s (isType=%s)',
        change.id.getFullName(),
        before.elemID.getFullName(),
        isType(beforeType),
        after.elemID.getFullName(),
        isType(afterType),
      )
      return 'none'
    }
    // Since we are checking the state, we are looking at the the type after all changes.
    // we need to handle the case where the type itself changed as well, so in order to
    // tell whether the type was hidden before, we also have to check if it changed
    const beforeHidden =
      (isHiddenValue(beforeType) && !hideTypeIds.has(beforeType.elemID.getFullName())) ||
      unhideTypeIds.has(beforeType.elemID.getFullName())

    if (!beforeHidden && isHiddenValue(afterType)) {
      return 'hide'
    }
    if (beforeHidden && !isHiddenValue(afterType)) {
      return 'unhide'
    }
    return 'none'
  }

const groupAnnotationIdsByParentAndName = (ids: ElemID[]): Record<string, Set<string>> =>
  _.mapValues(
    _.groupBy(ids, id => id.createTopLevelParentID().parent.getFullName()),
    idsOfParent => new Set(idsOfParent.map(id => id.name)),
  )

const getChangeParentIdsByHideAction = (changes: DetailedChange[]): { hide: Set<string>; unhide: Set<string> } => {
  const [hideChanges, unhideChanges] = _.partition(
    changes,
    c =>
      isAttributeChangeToHidden(c, true) ||
      isFieldAdditionWithHiddenValue(c) ||
      isFieldModificationChangeToHiddenValue(c),
  )
  return {
    hide: new Set(
      hideChanges.map(change => {
        if (isAttributeChangeToHidden(change, true)) {
          return change.id.createParentID().getFullName()
        }
        return change.id.getFullName()
      }),
    ),
    unhide: new Set(
      unhideChanges.map(change => {
        if (isAttributeChangeToNotHidden(change, true)) {
          return change.id.createParentID().getFullName()
        }
        return change.id.getFullName()
      }),
    ),
  }
}

/**
 * When a field or annotation changes from/to hidden, we need to create changes that add/remove
 * the values of that field in all relevant instances / annotation values
 */
const getHiddenFieldAndAnnotationValueChanges = async (
  changes: DetailedChangeWithBaseChange[],
  state: State,
  visibleElementSource: ReadOnlyElementsSource,
): Promise<DetailedChangeWithBaseChange[]> => {
  // TODO hide fields marked with _hidden=true

  // We need to find the following cases:
  // - When a specific field changes its _hidden_value -> affects all values of that field
  // - When a type changes its _hidden_value -> affects all annotation values of that type
  // - When an annotation type changes -> affects all values of that annotation type
  //
  // Note that when a field changes its type it does not matter because we don't take the type
  // into account when deciding whether an instance's value is hidden in isHiddenValue

  const { hide: hideFieldIds, unhide: unhideFieldIds } = getChangeParentIdsByHideAction(
    changes.filter(isHiddenChangeOnField),
  )

  const { hide: hideTypeIds, unhide: unhideTypeIds } = getChangeParentIdsByHideAction(
    changes.filter(c => isHiddenAttributeChange(c, true)),
  )

  const annotationTypeChanges = changes.filter(isAnnotationTypeChange)
  const annotationTypeChangesByHiddenEffect = await awu(annotationTypeChanges).groupBy(
    getTypeChangeEffectOnHidden(state, hideTypeIds, unhideTypeIds),
  )

  const noRelevantChanges =
    _.isEmpty(hideFieldIds) &&
    _.isEmpty(unhideFieldIds) &&
    _.isEmpty(hideTypeIds) &&
    _.isEmpty(unhideTypeIds) &&
    _.isEmpty(annotationTypeChangesByHiddenEffect.hide) &&
    _.isEmpty(annotationTypeChangesByHiddenEffect.unhide)
  if (noRelevantChanges) {
    // This should be the common case where there are no changes to the hidden annotation
    return []
  }
  const annotationTypesToHide = groupAnnotationIdsByParentAndName(
    annotationTypeChangesByHiddenEffect.hide?.map(change => change.id) ?? [],
  )
  const annotationTypesToUnHide = groupAnnotationIdsByParentAndName(
    annotationTypeChangesByHiddenEffect.unhide?.map(change => change.id) ?? [],
  )

  log.debug('Handling changes in hidden values and annotations:')
  log.debug('fields to hide: [%s]', [...hideFieldIds.values()].join(', '))
  log.debug('fields to unhide: [%s]', [...unhideFieldIds.values()].join(', '))
  log.debug('types to hide: [%s]', [...hideTypeIds.values()].join(', '))
  log.debug('types to unhide: [%s]', [...unhideTypeIds.values()].join(', '))
  log.debug(
    'annotation types to hide: [%s]',
    Object.entries(annotationTypesToHide)
      .flatMap(([typeName, annotationName]) => `${typeName}.annotation.${annotationName}`)
      .join(', '),
  )
  log.debug(
    'annotation types to unhide: [%s]',
    Object.entries(annotationTypesToUnHide)
      .flatMap(([typeName, annotationName]) => `${typeName}.annotation.${annotationName}`)
      .join(', '),
  )

  const getVisibleElementWithHiddenValueChanges = async ({
    stateElement,
    visibleElement,
  }: {
    stateElement: Element
    visibleElement: Element
  }): Promise<Element> => {
    const clonedVisibleElement = visibleElement.clone()

    const transformFunc: TransformFunc = ({ value, field, path }) => {
      if (path === undefined) {
        return value
      }
      if (isField(value)) {
        // Handle annotation values that now have a different type
        // Note we have to do this first because when transforming fields the "field" we get here
        // is undefined
        const annotationsToHide = annotationTypesToHide[value.refType.elemID.getFullName()]
        const annotationsToUnHide = annotationTypesToUnHide[value.refType.elemID.getFullName()]
        if (annotationsToHide !== undefined || annotationsToUnHide !== undefined) {
          Object.entries(value.annotations).forEach(([name, attrValue]) => {
            if (annotationsToHide?.has(name)) {
              setPath(clonedVisibleElement, path.createNestedID(name), undefined)
            } else if (annotationsToUnHide?.has(name)) {
              setPath(clonedVisibleElement, path.createNestedID(name), attrValue)
            }
          })
        }
      }
      if (field === undefined) {
        return value
      }
      // Handle field values in instances
      const fieldId = field.elemID.getFullName()
      const fieldTypeId = field.refType.elemID.getFullName()
      if (hideFieldIds.has(fieldId)) {
        setPath(clonedVisibleElement, path, undefined)
        return undefined
      }
      if (unhideFieldIds.has(fieldId)) {
        setPath(clonedVisibleElement, path, value)
        return undefined
      }
      // Handle annotation values on types
      if (path.idType === 'attr') {
        const isInTypes = (id: ElemID, typeGroup: Record<string, Set<string>>): boolean =>
          typeGroup[id.createParentID().getFullName()]?.has(id.name)
        if (isInTypes(path, annotationTypesToHide) || hideTypeIds.has(fieldTypeId)) {
          setPath(clonedVisibleElement, path, undefined)
          return undefined
        }
        if (isInTypes(path, annotationTypesToUnHide) || unhideTypeIds.has(fieldTypeId)) {
          setPath(clonedVisibleElement, path, value)
          return undefined
        }
      }
      // Handle annotation values on fields where the annotation type has the same ID, but the type
      // itself has changed
      if (path.idType === 'field') {
        if (hideTypeIds.has(fieldTypeId)) {
          setPath(clonedVisibleElement, path, undefined)
        } else if (unhideTypeIds.has(fieldTypeId)) {
          setPath(clonedVisibleElement, path, value)
        }
      }
      return value
    }

    await transformElement({
      element: stateElement,
      transformFunc,
      strict: true,
      elementsSource: state,
      runOnFields: true,
      allowEmptyArrays: true,
      allowAllEmptyObjects: true,
    })

    return clonedVisibleElement
  }

  // In order to support making a field/annotation visible we must traverse all state elements
  // to find all the hidden values we need to add.
  // Theoretically in order to hide values we would need to iterate the visible elements
  // but since we assume a redundant remove change is handled gracefully, we optimize this
  // by only iterating the state elements and creating remove changes for values that are
  // newly hidden, some of these remove changes may be redundant (if the value we
  // are trying to hide was already removed manually from the visible element)
  return awu(await state.getAll())
    .flatMap(async stateElement => {
      const visibleElement = await visibleElementSource.get(stateElement.elemID)
      if (!isElement(visibleElement)) {
        return []
      }
      const modifiedVisibleElement = await getVisibleElementWithHiddenValueChanges({ stateElement, visibleElement })
      return detailedCompare(visibleElement, modifiedVisibleElement, { createFieldChanges: true })
    })
    .toArray()
}

const removeDuplicateChanges = (
  origChanges: DetailedChangeWithBaseChange[],
  additionalChanges: DetailedChangeWithBaseChange[],
): DetailedChangeWithBaseChange[] => {
  // If there are no additional changes we'll save the calculation time
  if (additionalChanges.length === 0) {
    return origChanges
  }
  // If we have multiple changes on the same ID, we want to take the newer change
  // (the one from additionalChanges) because it overrides the original, for example
  // this can happen if a field is both hidden and changed at the same time
  // this specific logic is needed to support cases in which we had multiple changes
  // with the same id (fragments addition)
  const origChangesById = _.groupBy(origChanges, change => change.id.getFullName())
  const additionalChangesById = _.groupBy(additionalChanges, change => change.id.getFullName())

  const changeById = {
    ...origChangesById,
    ...additionalChangesById,
  }

  // If we have a change to A.B and a change to A.B.C, the second change is redundant because
  // its value is included in the first one.
  const hasChangeOnParent = (id: ElemID): boolean => {
    if (id.isTopLevel()) {
      return false
    }
    const parent = id.createParentID()
    return changeById[parent.getFullName()] !== undefined || hasChangeOnParent(parent)
  }

  return Object.values(changeById)
    .flat()
    .filter(change => !hasChangeOnParent(change.id))
}

/**
 * This handles the cases where something changes from hidden to visible or vice-versa.
 * Since the hidden annotation is currently supported on types and fields, we need to handle
 * types that changed visibility and fields that changed visibility.
 */
const getHiddenChangeNaclSideEffects = async (
  changes: DetailedChangeWithBaseChange[],
  state: State,
  visibleElementSource: ReadOnlyElementsSource,
): Promise<DetailedChangeWithBaseChange[]> => {
  const additionalChanges = [
    ...(await getHiddenTypeChanges(changes, state)),
    ...(await getHiddenFieldAndAnnotationValueChanges(changes, state, visibleElementSource)),
    ...(await getInstanceTypeHiddenChanges(changes, state)),
  ]
  return additionalChanges
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
    : (await hiddenFunc(await getField(baseType, fieldPath, elementsSource), elementsSource)) ||
        isHiddenField(baseType, fieldPath.slice(0, -1), hiddenValue, elementsSource)
}

type RecursivePartialWithUndefined<T> =
  | undefined
  | T
  | (T extends object
      ? {
          [P in keyof T]?: RecursivePartialWithUndefined<T[P]>
        }
      : T extends (infer U)[]
        ? RecursivePartialWithUndefined<U>[]
        : never)

/**
 * Given a full value and its filtered visible part, calculate the complementing
 * hidden part.
 */
const calcHiddenPart = <V extends object>(fullValue: V, visibleValue?: V): RecursivePartialWithUndefined<V> => {
  const calcHiddenInner = <T>(full: T, visible?: T): RecursivePartialWithUndefined<T> => {
    if (full === visible) {
      return undefined
    }
    if (visible === undefined) {
      return full
    }

    if (Array.isArray(full)) {
      if (!Array.isArray(visible) || full.length !== visible.length) {
        // should never happen
        log.error('Unexpected hidden part found in array: %s', safeJsonStringify([full, visible]))
        return full
      }

      const arrayDiff = full.map((val, idx) => calcHiddenInner(val, visible[idx]))
      if (arrayDiff.some(val => !_.isEmpty(val))) {
        // invalid scenario - hidden parts within arrays are not supported
        log.error('Unexpected hidden part found in array: %s', safeJsonStringify([full, visible]))
        return arrayDiff as RecursivePartialWithUndefined<T>
      }
      return undefined
    }

    if (values.isPlainObject(full) && values.isPlainObject(visible)) {
      const res = _.pickBy(
        _.mapValues(full, (val, key) => {
          if (Object.prototype.hasOwnProperty.call(visible, key)) {
            const difference = calcHiddenInner(_.get(full, key), _.get(visible, key))
            if (_.isEmpty(difference)) {
              return undefined
            }
            return difference
          }
          return val
        }),
        values.isDefined,
      ) as RecursivePartialWithUndefined<T>
      return _.isEmpty(res) ? undefined : res
    }

    return undefined
  }

  return calcHiddenInner(fullValue, visibleValue)
}

const diffElements = <T extends Element>(visibleElem?: T, fullElem?: T): T | undefined => {
  if (fullElem === undefined) {
    return undefined
  }
  if (visibleElem === undefined) {
    return fullElem
  }
  const diffAnno = calcHiddenPart(fullElem.annotations, visibleElem.annotations)
  const diffAnnoTypes: ReferenceMap = {}
  if (isObjectType(fullElem) && isObjectType(visibleElem)) {
    const diffFields = _.pickBy(
      _.mapValues(fullElem.fields, (field, name) => diffElements(visibleElem.fields[name], field)),
      values.isDefined,
    )
    return [diffAnno, diffFields].every(_.isEmpty)
      ? undefined
      : (new ObjectType({
          elemID: fullElem.elemID,
          annotationRefsOrTypes: diffAnnoTypes,
          annotations: diffAnno,
          fields: diffFields,
          path: fullElem.path,
          metaType: fullElem.metaType,
          isSettings: fullElem.isSettings,
        }) as unknown as T)
  }
  if (isPrimitiveType(fullElem) && isPrimitiveType(visibleElem)) {
    return [diffAnno, diffAnnoTypes].every(_.isEmpty)
      ? undefined
      : (new PrimitiveType({
          elemID: fullElem.elemID,
          primitive: fullElem.primitive,
          annotationRefsOrTypes: diffAnnoTypes,
          annotations: diffAnno,
          path: fullElem.path,
        }) as unknown as T)
  }
  if (isInstanceElement(fullElem) && isInstanceElement(visibleElem)) {
    const diffValue = calcHiddenPart(fullElem.value, visibleElem.value)
    if ([diffAnno, diffAnnoTypes, diffValue].every(_.isEmpty)) {
      return undefined
    }
    const res = new InstanceElement(fullElem.elemID.name, fullElem.refType, diffValue, fullElem.path, diffAnno)
    return res as unknown as T
  }
  if (isField(fullElem) && isField(visibleElem)) {
    if (_.isEmpty(diffAnno)) {
      return undefined
    }
    const res = new Field(fullElem.parent, fullElem.elemID.name, fullElem.refType, diffAnno)
    return res as unknown as T
  }
  return fullElem
}

// Avoid using this function from out of this file. This filters out only the hidden changes but not
// their side effects like done in handleHiddenChanges.
export const filterOutHiddenChanges = async (
  changes: DetailedChangeWithBaseChange[],
  state: State,
): Promise<{ visible?: DetailedChangeWithBaseChange; hidden?: DetailedChangeWithBaseChange }[]> => {
  const filterOutHidden = async (
    change: DetailedChangeWithBaseChange,
  ): Promise<{ visible?: DetailedChangeWithBaseChange; hidden?: DetailedChangeWithBaseChange }> => {
    if (isRemovalChange(change)) {
      // There should be no harm in letting remove changes through here. remove should be resilient
      // to its subject not existing. We create both visible and hidden changes in order
      // to make sure that hidden parts are removed from the cache as well.
      return { visible: change, hidden: change }
    }

    const { parent, path } = change.id.createTopLevelParentID()
    const baseElem = change.id.isTopLevel() ? change.data.after : await state.get(parent)

    if (baseElem === undefined) {
      // If something is not in the state it cannot be hidden
      return { visible: change }
    }

    if ((isType(baseElem) || isInstanceElement(baseElem)) && (await isHidden(baseElem, state))) {
      // A change of a hidden type or instance should be omitted completely
      return { hidden: change }
    }

    if (isElement(change.data.after)) {
      // Remove nested hidden parts of instances, object types and fields
      const visible = await applyFunctionToChangeData(change, element => removeHiddenFromElement(element, state))
      const after = diffElements(visible.data.after, change.data.after)
      return {
        visible,
        hidden:
          after &&
          ({
            ...change,
            data: {
              ...change.data,
              after,
            },
          } as DetailedChange),
      }
    }

    if (isInstanceElement(baseElem) || (isObjectType(baseElem) && ['field', 'attr'].includes(change.id.idType))) {
      // Instance values and annotation values in fields and objects can be hidden
      const getChangeTypeAndPath = async (): Promise<{
        changeType: TypeElement | undefined
        changePath: ReadonlyArray<string>
      }> => {
        if (change.id.isAttrID()) {
          return {
            changeType: (await elementAnnotationTypes(baseElem, state))[path[0]],
            changePath: path.slice(1),
          }
        }
        if (isInstanceElement(baseElem)) {
          return {
            changeType: await baseElem.getType(state),
            changePath: path,
          }
        }

        // idType === 'field'
        const field = baseElem.fields[path[0]]
        return {
          // changeType will be undefined if the path is too short
          changeType: field === undefined ? undefined : (await elementAnnotationTypes(field, state))[path[1]],
          changePath: path.slice(2),
        }
      }

      const { changeType, changePath } = await getChangeTypeAndPath()
      if (changeType === undefined) {
        // a value without a type cannot be hidden
        return { visible: change }
      }

      if (isHiddenValue(changeType)) {
        // The change is in a hidden annotation, omit it
        return { hidden: change }
      }

      if (await isHiddenField(changeType, changePath, isInstanceElement(baseElem), state)) {
        // The change is inside a hidden field value, omit the change
        return { hidden: change }
      }

      const fieldType = changeType && (await getFieldType(changeType, changePath, state))
      if (isObjectType(fieldType) || isMapType(fieldType)) {
        const visible = await applyFunctionToChangeData(change, value =>
          removeHiddenFromValues(fieldType, value, change.id, state),
        )
        const hidden = calcHiddenPart(change.data.after, visible.data.after)
        if (hidden === undefined) {
          return { visible }
        }
        return {
          visible,
          hidden: {
            ...change,
            data: {
              after: hidden,
            },
          } as DetailedChangeWithBaseChange,
        }
      }
    }

    return { visible: change }
  }

  return awu(changes).map(filterOutHidden).toArray()
}

export const handleHiddenChanges = async (
  changes: DetailedChangeWithBaseChange[],
  state: State,
  visibleElementSource: ReadOnlyElementsSource,
): Promise<{ visible: DetailedChangeWithBaseChange[]; hidden: DetailedChangeWithBaseChange[] }> => {
  // The side effects here are going to be applied to the nacls, so only
  // the visible part is needed. We filter it here and not with the rest
  // of the changes in order to prevent remove changes (which are always
  // sent to both the visible and hidden parts) from being applied to
  // the state as well.
  const additionalNaclChanges = (
    await filterOutHiddenChanges(await getHiddenChangeNaclSideEffects(changes, state, visibleElementSource), state)
  )
    .map(change => change.visible)
    .filter(values.isDefined)
  const filteredChanges = await filterOutHiddenChanges(changes, state)
  return {
    visible: removeDuplicateChanges(
      filteredChanges.map(change => change.visible).filter(values.isDefined),
      additionalNaclChanges,
    ),
    hidden: filteredChanges.map(change => change.hidden).filter(values.isDefined),
  }
}
