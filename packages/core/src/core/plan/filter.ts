/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import wu from 'wu'
import _ from 'lodash'

import { DataNodeMap, DiffGraph, DiffNode } from '@salto-io/dag'
import {
  ChangeError,
  ChangeValidator,
  getChangeData,
  ElemID,
  ObjectType,
  ChangeDataType,
  isField,
  isObjectType,
  ReadOnlyElementsSource,
  SeverityLevel,
  DependencyError,
  Change,
  isAdditionChange,
  isRemovalChange,
  toChange,
  isFieldChange,
  Field,
  isObjectTypeChange,
  cloneDeepWithoutRefs,
  SaltoErrorType,
  CircularDependencyChangeError,
  isCircularDependencyChangeError,
} from '@salto-io/adapter-api'
import { values, collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'

const log = logger(module)
const { awu } = collections.asynciterable

export type FilterResult = {
  changeErrors: ChangeError[]
  validDiffGraph: DiffGraph<ChangeDataType>
  replacedGraph: boolean
}

const createValidType = (typeChange: Change<ObjectType>, invalidChangesElemIds: ElemID[]): ObjectType | undefined => {
  const elementsToOmit = new Set(invalidChangesElemIds.map(elemId => elemId.createBaseID().parent.getFullName()))
  const isTypeAnnotationsInvalid = elementsToOmit.has(getChangeData(typeChange).elemID.getFullName())
  if (isRemovalChange(typeChange) || (isAdditionChange(typeChange) && isTypeAnnotationsInvalid)) {
    return undefined
  }
  const beforeObj = isAdditionChange(typeChange) ? undefined : typeChange.data.before
  const afterObj = typeChange.data.after

  const beforeFieldsForAfter = _.pickBy(beforeObj?.fields, field => elementsToOmit.has(field.elemID.getFullName()))
  const afterFieldsForAfter = _.pickBy(afterObj.fields, field => !elementsToOmit.has(field.elemID.getFullName()))
  const fieldsForAfter = { ...beforeFieldsForAfter, ...afterFieldsForAfter }

  // revert the invalid changes in type annotations if there are.
  const typeToClone = beforeObj !== undefined && isTypeAnnotationsInvalid ? beforeObj : afterObj
  return new ObjectType({
    elemID: typeToClone.elemID,
    fields: fieldsForAfter,
    annotationRefsOrTypes: _.clone(typeToClone.annotationRefTypes),
    annotations: cloneDeepWithoutRefs(typeToClone.annotations),
    metaType: typeToClone.metaType,
    isSettings: typeToClone.isSettings,
  })
}

const createValidAfterOfInvalidTypesMap = async (
  beforeElements: ReadOnlyElementsSource,
  afterElements: ReadOnlyElementsSource,
  changeErrors: ChangeError[],
): Promise<Map<string, ObjectType>> => {
  const changeErrorIdsByTopLevelId = Object.entries(
    _.groupBy(
      changeErrors.map(changeError => changeError.elemID),
      elemId => elemId.createTopLevelParentID().parent.getFullName(),
    ),
  )

  const validTypes = await awu(changeErrorIdsByTopLevelId)
    .map(async ([topLevelId, invalidChangesElemIds]) => {
      const elemID = ElemID.fromFullName(topLevelId)
      const beforeElem = await beforeElements.get(elemID)
      const afterElem = await afterElements.get(elemID)
      if (!isObjectType(beforeElem) && !isObjectType(afterElem)) {
        return undefined
      }
      const typeChange = toChange({
        before: isObjectType(beforeElem) ? beforeElem : undefined,
        after: isObjectType(afterElem) ? afterElem : undefined,
      })
      return createValidType(typeChange, invalidChangesElemIds)
    })
    .filter(values.isDefined)
    .toArray()

  return new Map(validTypes.map(type => [type.elemID.getFullName(), type]))
}

const createDependencyErr = (causeID: ElemID, droppedID: ElemID): DependencyError => ({
  causeID,
  elemID: droppedID,
  message: 'Element cannot be deployed due to an error in its dependency',
  detailedMessage: `${droppedID.getFullName()} cannot be deployed due to an error in its dependency ${causeID.getFullName()}. Please resolve that error and try again.`,
  severity: 'Error' as SeverityLevel,
  type: 'dependency' as SaltoErrorType,
})

export const createCircularDependencyError = (
  droppedID: ElemID,
  cycleIDs: ElemID[],
): CircularDependencyChangeError => ({
  elemID: droppedID,
  cycleIDs,
  severity: 'Error',
  message: 'Skipped element due to circular dependencies',
  detailedMessage: `Element will be skipped due to circular dependencies among the following elements: ${cycleIDs.map(id => id.getFullName()).join(', ')}. Consider splitting this into two separate deployments.`,
})

const buildValidDiffGraph = (
  diffGraph: DiffGraph<ChangeDataType>,
  invalidChanges: ChangeError[],
  validAfterOfInvalidTypesMap: Map<string, ObjectType>,
): {
  validDiffGraph: DiffGraph<ChangeDataType>
  dependencyErrors: DependencyError[]
} => {
  const getValidAfterOfInvalidElement = (element: ObjectType | Field): ObjectType | Field => {
    if (isField(element)) {
      const validParent = validAfterOfInvalidTypesMap.get(element.parent.elemID.getFullName())
      // if the field parent is not in validAfterOfInvalidTypesMap, it means that the original field is valid
      return validParent !== undefined ? validParent.fields[element.name] : element
    }
    const validType = validAfterOfInvalidTypesMap.get(element.elemID.getFullName())
    // if the type is not in validAfterOfInvalidTypesMap, it means that the original type is valid
    return validType !== undefined ? validType : element
  }

  const getValidChange = ({ originalId, ...change }: DiffNode<ChangeDataType>): DiffNode<ChangeDataType> => {
    if ((!isObjectTypeChange(change) && !isFieldChange(change)) || isRemovalChange(change)) {
      return { originalId, ...change }
    }
    const before = isAdditionChange(change) ? undefined : change.data.before
    // In case of a type/field change we want to take only the valid changes in the after element
    const after = getValidAfterOfInvalidElement(change.data.after)
    return { originalId, ...toChange({ before, after }) }
  }

  const elemIdsToOmit = new Set(invalidChanges.map(change => change.elemID.createBaseID().parent.getFullName()))
  const nodeIdsToOmit = wu(diffGraph.keys())
    .filter(nodeId => {
      const change = diffGraph.getData(nodeId)
      const changeElem = getChangeData(change)
      return elemIdsToOmit.has(changeElem.elemID.getFullName())
    })
    .toArray()

  const dependenciesMap = Object.fromEntries(
    wu(nodeIdsToOmit).map(id => [id, diffGraph.getComponent({ roots: [id], reverse: true })]),
  )

  const nodesToOmitWithDependents = Object.values(dependenciesMap).flatMap(nodeIds => [...nodeIds])

  const circularDependencyIDs = new Set(
    invalidChanges.filter(error => isCircularDependencyChangeError(error)).map(error => error.elemID.getFullName()),
  )

  const dependencyErrors = Object.entries(dependenciesMap)
    .map(
      ([causeNodeId, nodeIds]) =>
        [
          getChangeData(diffGraph.getData(causeNodeId)).elemID,
          wu(nodeIds.keys())
            .map(id => getChangeData(diffGraph.getData(id)).elemID)
            .toArray(),
        ] as [ElemID, ElemID[]],
    )
    .map(
      ([causeID, elemIds]) =>
        [causeID, elemIds.filter(elemId => !elemId.isEqual(causeID) && !causeID.isParentOf(elemId))] as [
          ElemID,
          ElemID[],
        ],
    )
    .flatMap(([causeID, elemIDs]) =>
      elemIDs
        .filter(elemID => !circularDependencyIDs.has(elemID.getFullName())) // filter out elemIDs that already have circular dependency error to avoid duplicaitons
        .map(elemID => createDependencyErr(causeID, elemID)),
    )

  const allNodeIdsToOmit = new Set(nodesToOmitWithDependents)
  const nodesToInclude = new Set(wu(diffGraph.keys()).filter(id => !allNodeIdsToOmit.has(id)))

  log.warn(
    'removing the following changes from plan: %o',
    wu(allNodeIdsToOmit.keys())
      .map(nodeId => diffGraph.getData(nodeId).originalId)
      .toArray(),
  )

  const validDiffGraph = new DataNodeMap<DiffNode<ChangeDataType>>()
  wu(nodesToInclude.keys()).forEach(nodeId => {
    const change = diffGraph.getData(nodeId)
    const validChange = getValidChange(change)
    validDiffGraph.addNode(
      nodeId,
      wu(diffGraph.get(nodeId)).filter(id => nodesToInclude.has(id)),
      validChange,
    )
  })

  return { validDiffGraph, dependencyErrors }
}

export const getChangeErrors = async (
  afterElements: ReadOnlyElementsSource,
  diffGraph: DiffGraph<ChangeDataType>,
  changeValidators: Record<string, ChangeValidator>,
): Promise<ChangeError[]> =>
  log.timeDebug(
    async () => {
      if (Object.keys(changeValidators).length === 0) {
        return []
      }

      const changesByAdapter = collections.iterable.groupBy(
        wu(diffGraph.keys()).map(changeId => diffGraph.getData(changeId)),
        change => getChangeData(change).elemID.adapter,
      )

      const changeErrors = await awu(changesByAdapter.entries())
        .filter(([adapter]) => adapter in changeValidators)
        .flatMap(([adapter, changes]) => changeValidators[adapter](changes, afterElements))
        .toArray()

      return changeErrors
    },
    'getChangeErrors for %d changes with %d validators',
    diffGraph.size,
    Object.keys(changeValidators).length,
  )

export const filterInvalidChanges = (
  beforeElements: ReadOnlyElementsSource,
  afterElements: ReadOnlyElementsSource,
  diffGraph: DiffGraph<ChangeDataType>,
  changeErrors: ChangeError[],
): Promise<FilterResult> =>
  log.timeDebug(
    async () => {
      const invalidChanges = changeErrors.filter(v => v.severity === 'Error')
      if (invalidChanges.length === 0) {
        // Shortcut to avoid replacing the graph if there are no errors
        return { changeErrors, validDiffGraph: diffGraph, replacedGraph: false }
      }

      const validAfterTypeElementsMap = await createValidAfterOfInvalidTypesMap(
        beforeElements,
        afterElements,
        invalidChanges,
      )
      const { validDiffGraph, dependencyErrors } = buildValidDiffGraph(
        diffGraph,
        invalidChanges,
        validAfterTypeElementsMap,
      )

      return {
        changeErrors: [...changeErrors, ...dependencyErrors],
        validDiffGraph,
        replacedGraph: true,
      }
    },
    'filterInvalidChanges for %d changes with %d change errors',
    diffGraph.size,
    changeErrors.length,
  )
