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

import { DataNodeMap, DiffGraph, DiffNode, NodeId } from '@salto-io/dag'
import { ChangeError, TypeElement, ChangeValidator, getChangeData, ElemID, ObjectType, ChangeDataType, isField, isObjectType, ReadOnlyElementsSource, SeverityLevel, DependencyError, Change, isAdditionChange, isRemovalChange, toChange, isType, isInstanceChange, CompareOptions, isEqualElements, isModificationChange, isFieldChange } from '@salto-io/adapter-api'
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
  compareOptions: CompareOptions | undefined
): Promise<FilterResult> => log.time(async () => {
  const createValidTypeElement = (
    typeElementChange: Change<TypeElement>,
    elemIdsToOmit: ElemID[]
  ): TypeElement | undefined => {
    const onlyInvalidFields = !elemIdsToOmit.some(elemId => elemId.createBaseID().parent
      .isEqual(getChangeData(typeElementChange).elemID))
    if (isAdditionChange(typeElementChange) && !onlyInvalidFields) {
      // revert the invalid creation of a new type element
      return undefined
    }
    if (isRemovalChange(typeElementChange) || (isModificationChange(typeElementChange)
    && elemIdsToOmit.some(elemId => typeElementChange.data.after.elemID.isEqual(elemId)))) {
      // revert the invalid deletion of a type element OR
      // modification of a type element that should be reverted as a whole
      return typeElementChange.data.before.clone()
    }
    const beforeObj = isAdditionChange(typeElementChange) ? undefined : typeElementChange.data.before
    const afterObj = typeElementChange.data.after
    if ((beforeObj && !isObjectType(beforeObj)) || !isObjectType(afterObj)) {
      return afterObj.clone()
    }
    // ObjectType's fields changes
    const allFieldNames = _.uniq(Object.keys(afterObj.fields).concat(Object.keys(beforeObj?.fields ?? {})))
    const fieldsElemIdsToOmit = new Set(elemIdsToOmit
      .filter(elemId => elemId.idType === 'field')
      .map(elemId => elemId.createBaseID().parent.getFullName()))
    const validFields = allFieldNames
      .map(name => {
        const beforeField = beforeObj?.fields[name]
        const afterField = afterObj.fields[name]
        const { elemID } = afterField ?? beforeField
        const validField = fieldsElemIdsToOmit.has(elemID.getFullName())
          ? beforeField
          : afterField
        return validField === undefined ? undefined : validField.clone()
      })
      .filter(values.isDefined)

    if (beforeObj === undefined && !onlyInvalidFields) {
      // should not happen
      throw new Error(`invalid creation of new type ${afterObj.elemID.getFullName()} should be reverted`)
    }
    // revert the invalid changes in type annotations if there are.
    const typeToClone = beforeObj === undefined || onlyInvalidFields ? afterObj : beforeObj
    return new ObjectType({
      elemID: typeToClone.elemID,
      fields: _.keyBy(validFields, field => field.name),
      annotationRefsOrTypes: _.clone(typeToClone.annotationRefTypes),
      annotations: _.cloneDeep(typeToClone.annotations),
      isSettings: typeToClone.isSettings,
    })
  }

  const createValidAfterTypeElementsMap = async (
    invalidChanges: ChangeError[]
  ): Promise<Record<string, TypeElement>> => {
    const topLevelNodeIdToInvalidElemIds = _.groupBy(
      invalidChanges.map(c => c.elemID),
      elemId => elemId.createTopLevelParentID().parent.getFullName()
    )
    return awu(invalidChanges)
      .map(async change => {
        const elemID = change.elemID.createTopLevelParentID().parent
        const beforeElem = await beforeElements.get(elemID)
        const afterElem = await afterElements.get(elemID)
        if (!isType(beforeElem) && !isType(afterElem)) {
          return undefined
        }
        const typeElementChange = toChange({
          before: isType(beforeElem) ? beforeElem : undefined,
          after: isType(afterElem) ? afterElem : undefined,
        })
        if (topLevelNodeIdToInvalidElemIds[elemID.getFullName()]) {
          return createValidTypeElement(typeElementChange, topLevelNodeIdToInvalidElemIds[elemID.getFullName()])
        }
        return isType(afterElem) ? afterElem : undefined
      })
      .filter(values.isDefined)
      .keyBy(e => e.elemID.getFullName())
  }

  const buildValidDiffGraph = (
    nodeElemIdsToOmit: Set<NodeId>,
    validAfterElementsMap: Record<string, TypeElement>
  ): {
    validDiffGraph: DiffGraph<ChangeDataType>
    dependencyErrors: DependencyError[]
  } => {
    const getValidAfter = (elem: ChangeDataType): ChangeDataType | undefined => {
      if (isField(elem)) {
        const validParent = validAfterElementsMap[elem.parent.elemID.getFullName()]
        return isObjectType(validParent) ? validParent.fields[elem.name] : undefined
      }
      return validAfterElementsMap[elem.elemID.getFullName()]
    }
    const replaceAfter = (
      { originalId, ...change }: DiffNode<ChangeDataType>
    ): DiffNode<ChangeDataType> | undefined => {
      if (isInstanceChange(change)) {
        return { originalId, ...change }
      }
      const before = isAdditionChange(change) ? undefined : change.data.before
      // In case of a type/field change we want to take only the valid changes in the after element
      const after = isRemovalChange(change) ? undefined : getValidAfter(change.data.after)
      if (isEqualElements(before, after, compareOptions)) {
        return undefined
      }
      return { originalId, ...toChange({ before, after }) }
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
      const validChange = replaceAfter(change)
      if (validChange) {
        validDiffGraph.addNode(
          nodeId,
          wu(diffGraph.get(nodeId)).filter(id => nodesToInclude.has(id)),
          validChange
        )
      } else if (isFieldChange(change)) {
        const changeElemId = getChangeData(change).elemID
        const { parent } = changeElemId.createTopLevelParentID()
        dependencyErrors.push(createDependencyErr(parent, changeElemId))
      } else {
        // should not happen
        throw new Error(`change ${nodeId} should be a field change`)
      }
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
  const validAfterTypeElementsMap = await createValidAfterTypeElementsMap(invalidChanges)
  const { validDiffGraph, dependencyErrors } = buildValidDiffGraph(
    nodeElemIdsToOmit,
    validAfterTypeElementsMap
  )
  return {
    changeErrors: [...changeErrors, ...dependencyErrors],
    validDiffGraph,
    replacedGraph: true,
  }
}, 'filterInvalidChanges for %d changes with %d validators', diffGraph.size, Object.keys(changeValidators).length)
