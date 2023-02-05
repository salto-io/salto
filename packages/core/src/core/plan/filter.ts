/*
*                      Copyright 2023 Salto Labs Ltd.
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
import wu from 'wu'
import _ from 'lodash'

import { DataNodeMap, DiffGraph, DiffNode } from '@salto-io/dag'
import { ChangeError, ChangeValidator, getChangeData, ElemID, ObjectType, ChangeDataType, isField, isObjectType, ReadOnlyElementsSource, SeverityLevel, DependencyError, Change, isAdditionChange, isRemovalChange, toChange, isFieldChange, Field, isObjectTypeChange } from '@salto-io/adapter-api'
import { values, collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'

const log = logger(module)
const { awu } = collections.asynciterable

type FilterResult = {
  changeErrors: ChangeError[]
  validDiffGraph: DiffGraph<ChangeDataType>
  replacedGraph: boolean
}

export const filterInvalidChanges = (
  beforeElements: ReadOnlyElementsSource,
  afterElements: ReadOnlyElementsSource,
  diffGraph: DiffGraph<ChangeDataType>,
  changeValidators: Record<string, ChangeValidator>,
): Promise<FilterResult> => log.time(async () => {
  const createValidType = (
    typeChange: Change<ObjectType>,
    invalidChangesElemIds: ElemID[]
  ): ObjectType | undefined => {
    const elementsToOmit = new Set(invalidChangesElemIds.map(elemId => elemId.createBaseID().parent.getFullName()))
    const onlyInvalidFields = !elementsToOmit.has(getChangeData(typeChange).elemID.getFullName())
    if (isRemovalChange(typeChange) || (isAdditionChange(typeChange) && !onlyInvalidFields)) {
      return undefined
    }
    const beforeObj = isAdditionChange(typeChange) ? undefined : typeChange.data.before
    const afterObj = typeChange.data.after

    const beforeFieldsForAfter = _.pickBy(beforeObj?.fields, field => elementsToOmit.has(field.elemID.getFullName()))
    const afterFieldsForAfter = _.pickBy(afterObj.fields, field => !elementsToOmit.has(field.elemID.getFullName()))
    const fieldsForAfter = _.mapValues(
      { ...beforeFieldsForAfter, ...afterFieldsForAfter },
      field => ({ refType: field.refType, annotations: field.annotations })
    )
    // revert the invalid changes in type annotations if there are.
    const typeToClone = beforeObj === undefined || onlyInvalidFields ? afterObj : beforeObj
    return new ObjectType({
      elemID: typeToClone.elemID,
      fields: fieldsForAfter,
      annotationRefsOrTypes: _.clone(typeToClone.annotationRefTypes),
      annotations: _.cloneDeep(typeToClone.annotations),
      isSettings: typeToClone.isSettings,
    })
  }

  const createValidAfterOfInvalidTypesMap = async (
    invalidChanges: ChangeError[]
  ): Promise<Map<string, ObjectType>> =>
    new Map(await awu(Object.entries(_.groupBy(
      invalidChanges.map(changeError => changeError.elemID),
      elemId => elemId.createTopLevelParentID().parent.getFullName()
    )))
      .map(async ([topLevelId, invalidChangesElemIds]): Promise<[string, ObjectType] | undefined> => {
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
        const validType = createValidType(typeChange, invalidChangesElemIds)
        if (validType === undefined) {
          return undefined
        }
        return [topLevelId, validType]
      })
      .filter(values.isDefined).toArray())

  const buildValidDiffGraph = (
    invalidChanges: ChangeError[],
    validAfterOfInvalidTypesMap: Map<string, ObjectType>
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
    const replaceAfterIfInvalid = (
      { originalId, ...change }: DiffNode<ChangeDataType>
    ): DiffNode<ChangeDataType> => {
      if (!isObjectTypeChange(change) && !isFieldChange(change)) {
        return { originalId, ...change }
      }
      const before = isAdditionChange(change) ? undefined : change.data.before
      // In case of a type/field change we want to take only the valid changes in the after element
      const after = isRemovalChange(change) ? undefined : getValidAfterOfInvalidElement(change.data.after)
      return { originalId, ...toChange({ before, after }) }
    }

    const createDependencyErr = (causeID: ElemID, droppedID: ElemID): DependencyError => ({
      causeID,
      elemID: droppedID,
      message: 'Element cannot be deployed due to an error in its dependency',
      detailedMessage: `${droppedID.getFullName()} cannot be deployed due to an error in its dependency ${causeID.getFullName()}. Please resolve that error and try again.`,
      severity: 'Error' as SeverityLevel,
    })

    const elemIdsToOmit = new Set(
      invalidChanges.map(change => change.elemID.createBaseID().parent.getFullName())
    )
    const nodeIdsToOmit = wu(diffGraph.keys()).filter(nodeId => {
      const change = diffGraph.getData(nodeId)
      const changeElem = getChangeData(change)
      return elemIdsToOmit.has(changeElem.elemID.getFullName())
    }).toArray()

    const dependenciesMap = Object.fromEntries(wu(nodeIdsToOmit)
      .map(id => [id, diffGraph.getComponent({ roots: [id], reverse: true })]))

    const nodesToOmitWithDependents = Object.values(dependenciesMap)
      .flatMap(nodeIds => [...nodeIds])

    const dependencyErrors = Object.entries(dependenciesMap)
      .map(([causeNodeId, nodeIds]) => [
        getChangeData(diffGraph.getData(causeNodeId)).elemID,
        wu(nodeIds.keys()).map(id => getChangeData(diffGraph.getData(id)).elemID).toArray(),
      ] as [ElemID, ElemID[]])
      .map(([causeID, elemIds]) => [
        causeID,
        elemIds.filter(elemId => !elemId.isEqual(causeID)),
      ] as [ElemID, ElemID[]]).flatMap(
        ([causeID, elemIDs]) => elemIDs.map(elemID => createDependencyErr(causeID, elemID))
      )

    const allNodeIdsToOmit = new Set(nodesToOmitWithDependents)
    const nodesToInclude = new Set(wu(diffGraph.keys()).filter(
      id => !allNodeIdsToOmit.has(id)
    ))

    log.warn(
      'removing the following changes from plan: %o',
      wu(allNodeIdsToOmit.keys()).map(nodeId => diffGraph.getData(nodeId).originalId).toArray()
    )

    const validDiffGraph = new DataNodeMap<DiffNode<ChangeDataType>>()
    wu(nodesToInclude.keys()).forEach(nodeId => {
      const change = diffGraph.getData(nodeId)
      const validChange = replaceAfterIfInvalid(change)
      validDiffGraph.addNode(
        nodeId,
        wu(diffGraph.get(nodeId)).filter(id => nodesToInclude.has(id)),
        validChange
      )
    })

    return { validDiffGraph, dependencyErrors }
  }

  if (Object.keys(changeValidators).length === 0) {
    // Shortcut to avoid grouping all changes if there are no validators to run
    return { changeErrors: [], validDiffGraph: diffGraph, replacedGraph: false }
  }

  const changesByAdapter = collections.iterable.groupBy(
    wu(diffGraph.keys()).map(changeId => diffGraph.getData(changeId)),
    change => getChangeData(change).elemID.adapter,
  )

  const changeErrors = await awu(changesByAdapter.entries())
    .filter(([adapter]) => adapter in changeValidators)
    .flatMap(([adapter, changes]) => changeValidators[adapter](changes, afterElements))
    .toArray()

  const invalidChanges = changeErrors.filter(v => v.severity === 'Error')
  if (invalidChanges.length === 0) {
    // Shortcut to avoid replacing the graph if there are no errors
    return { changeErrors, validDiffGraph: diffGraph, replacedGraph: false }
  }
  const validAfterTypeElementsMap = await createValidAfterOfInvalidTypesMap(invalidChanges)
  const { validDiffGraph, dependencyErrors } = buildValidDiffGraph(
    invalidChanges,
    validAfterTypeElementsMap
  )
  return {
    changeErrors: [...changeErrors, ...dependencyErrors],
    validDiffGraph,
    replacedGraph: true,
  }
}, 'filterInvalidChanges for %d changes with %d validators', diffGraph.size, Object.keys(changeValidators).length)
