/*
*                      Copyright 2022 Salto Labs Ltd.
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

import { DataNodeMap, DiffGraph, DiffNode, NodeId } from '@salto-io/dag'
import { ChangeError, ElementMap, InstanceElement, TypeElement, ChangeValidator, getChangeData, ElemID, ObjectType, ChangeDataType, Element, isAdditionOrModificationChange, isField, isObjectType, ReadOnlyElementsSource, SeverityLevel, DependencyError } from '@salto-io/adapter-api'
import { values, collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'

const log = logger(module)
const { awu } = collections.asynciterable

type FilterResult = {
  changeErrors: ChangeError[]
  validDiffGraph: DiffGraph<ChangeDataType>
  replacedGraph: boolean
}

type TopLevelElement = InstanceElement | TypeElement

export const filterInvalidChanges = (
  beforeElements: ReadOnlyElementsSource,
  afterElements: ReadOnlyElementsSource,
  diffGraph: DiffGraph<ChangeDataType>,
  changeValidators: Record<string, ChangeValidator>,
): Promise<FilterResult> => log.time(async () => {
  const createValidTopLevelElem = (beforeTopLevelElem: TopLevelElement,
    afterTopLevelElem: TopLevelElement, elemIdsToOmit: ElemID[]): Element | undefined => {
    const elemIdFullNamesToOmit = new Set(elemIdsToOmit.map(id => id.getFullName()))
    if (_.isUndefined(beforeTopLevelElem)
      && elemIdFullNamesToOmit.has(afterTopLevelElem.elemID.getFullName())) {
      // revert the invalid creation of a new top-level element
      return undefined
    }
    if (_.isUndefined(afterTopLevelElem)
      || elemIdFullNamesToOmit.has(afterTopLevelElem.elemID.getFullName())) {
      // revert the invalid deletion of a top-level element OR
      // modification of a top level element that should be reverted as a whole
      return beforeTopLevelElem.clone()
    }
    if (
      (beforeTopLevelElem && !isObjectType(beforeTopLevelElem))
      || (afterTopLevelElem && !isObjectType(afterTopLevelElem))
    ) {
      // use the real top-level element (for example, the top-level instance for field changes)
      return afterTopLevelElem.clone()
    }
    // ObjectType's fields changes
    const beforeObj = beforeTopLevelElem
    const afterObj = afterTopLevelElem
    const afterFieldNames = afterObj ? Object.keys(afterObj.fields) : []
    const beforeFieldNames = beforeObj ? Object.keys(beforeObj.fields) : []
    const allFieldNames = [...new Set([...beforeFieldNames, ...afterFieldNames])]
    const validFields = allFieldNames
      .map(name => {
        const beforeField = beforeObj?.fields[name]
        const afterField = afterObj?.fields[name]
        const { elemID } = afterField ?? beforeField
        const validField = elemIdFullNamesToOmit.has(elemID.getFullName())
          ? beforeField
          : afterField
        return validField === undefined ? undefined : validField.clone()
      })
      .filter(values.isDefined)

    return new ObjectType({
      elemID: afterObj.elemID,
      fields: _.keyBy(validFields, field => field.name),
      annotationRefsOrTypes: _.clone(afterObj.annotationRefTypes),
      annotations: _.cloneDeep(afterObj.annotations),
      isSettings: afterObj.isSettings,
    })
  }

  const createValidAfterElementsMap = async (
    invalidChanges: ChangeError[]
  ): Promise<ElementMap> => {
    const topLevelNodeIdToInvalidElemIds = _(invalidChanges)
      .map(c => c.elemID)
      .groupBy(elemId => elemId.createTopLevelParentID().parent.getFullName())

    const validChangeElements = await awu(invalidChanges)
      .map(async change => {
        const elemID = change.elemID.createTopLevelParentID().parent
        const beforeElem = await beforeElements.get(elemID)
        const afterElem = await afterElements.get(elemID)
        const validElement = topLevelNodeIdToInvalidElemIds.has(elemID.getFullName())
          ? createValidTopLevelElem(beforeElem as TopLevelElement, afterElem as TopLevelElement,
            topLevelNodeIdToInvalidElemIds.get(elemID.getFullName()))
          : afterElem
        return validElement
      })
      .filter(values.isDefined)
      .toArray()

    return _.keyBy(validChangeElements, e => e.elemID.getFullName())
  }

  const buildValidDiffGraph = (nodeElemIdsToOmit: Set<NodeId>, validAfterElementsMap: ElementMap):
    { validDiffGraph: DiffGraph<ChangeDataType>; dependencyErrors: DependencyError[] } => {
    const getValidAfter = (elem: Element): Element | undefined => {
      if (isField(elem)) {
        const validParent = validAfterElementsMap[elem.parent.elemID.getFullName()] as ObjectType
        return validParent?.fields?.[elem.name]
      }
      return validAfterElementsMap[elem.elemID.getFullName()]
    }
    const replaceAfterElement = <T extends DiffNode<ChangeDataType>>(change: T): T => {
      if (isAdditionOrModificationChange(change)) {
        const after = getValidAfter(change.data.after) ?? change.data.after
        return { ...change, data: { ...change.data, after } }
      }
      return change
    }

    const nodeIdToElemId = (nodeId: NodeId): ElemID => (
      getChangeData(diffGraph.getData(nodeId)).elemID
    )

    const createDependencyErr = (causeID: ElemID, droppedID: ElemID): DependencyError => ({
      causeID,
      elemID: droppedID,
      message: 'Element cannot be deployed due to an error in its dependency',
      detailedMessage: `${droppedID.getFullName()} cannot be deployed due to an error in its dependency ${causeID.getFullName()}. Please resolve that error and try again.`,
      severity: 'Error' as SeverityLevel,
    })

    const validDiffGraph = new DataNodeMap<DiffNode<ChangeDataType>>()

    const nodeIdsToOmit = wu(diffGraph.keys()).filter(nodeId => {
      const change = diffGraph.getData(nodeId)
      const changeElem = getChangeData(change)
      return nodeElemIdsToOmit.has(changeElem.elemID.getFullName())
    }).toArray()

    const dependenciesMap = Object.fromEntries(wu(nodeIdsToOmit)
      .map(id => [id, diffGraph.getComponent({ roots: [id], reverse: true })]))


    const nodesToOmitWithDependents = Object.values(dependenciesMap)
      .flatMap(nodeIds => [...nodeIds])

    const dependencyErrors = Object.entries(dependenciesMap)
      .map(([causeNodeId, nodeIds]) => [
        nodeIdToElemId(causeNodeId),
        wu(nodeIds.keys()).map(nodeIdToElemId).toArray(),
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

    wu(nodesToInclude.keys()).forEach(nodeId => {
      const change = diffGraph.getData(nodeId)
      const validChange = replaceAfterElement(change)
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
  const nodeElemIdsToOmit = new Set(
    invalidChanges.map(change => change.elemID.createBaseID().parent.getFullName())
  )
  const validAfterElementsMap = await createValidAfterElementsMap(invalidChanges)
  const { validDiffGraph, dependencyErrors } = buildValidDiffGraph(
    nodeElemIdsToOmit,
    validAfterElementsMap
  )
  return {
    changeErrors: [...changeErrors, ...dependencyErrors],
    validDiffGraph,
    replacedGraph: true,
  }
}, 'filterInvalidChanges for %d changes with %d validators', diffGraph.size, Object.keys(changeValidators).length)
