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
import wu from 'wu'
import _ from 'lodash'

import { DataNodeMap, DiffGraph, DiffNode, WalkError } from '@salto-io/dag'
import { ChangeError, ElementMap, InstanceElement, TypeElement, ChangeValidator, getChangeElement, ElemID, ObjectType, ChangeDataType, Element, isAdditionOrModificationChange, isField, isObjectType } from '@salto-io/adapter-api'
import { values, collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'

const log = logger(module)

type FilterResult = {
  changeErrors: ChangeError[]
  validDiffGraph: DiffGraph<ChangeDataType>
}

type TopLevelElement = InstanceElement | TypeElement

export const filterInvalidChanges = async (
  beforeElementsMap: ElementMap,
  afterElementsMap: ElementMap,
  diffGraph: DiffGraph<ChangeDataType>,
  changeValidators: Record<string, ChangeValidator>,
): Promise<FilterResult> => {
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

  const createValidAfterElementsMap = (invalidChanges: ChangeError[]): ElementMap => {
    const topLevelNodeIdToInvalidElemIds = _(invalidChanges)
      .map(c => c.elemID)
      .groupBy(elemId => elemId.createTopLevelParentID().parent.getFullName())

    const beforeElementNames = Object.keys(beforeElementsMap)
    const afterElementNames = Object.keys(afterElementsMap)
    const allElementNames = [...new Set([...beforeElementNames, ...afterElementNames])]
    return _(allElementNames)
      .map(name => {
        const beforeElem = beforeElementsMap[name]
        const afterElem = afterElementsMap[name]
        const { elemID } = afterElem ?? beforeElem
        const validElement = topLevelNodeIdToInvalidElemIds.has(elemID.getFullName())
          ? createValidTopLevelElem(beforeElem as TopLevelElement, afterElem as TopLevelElement,
            topLevelNodeIdToInvalidElemIds.get(elemID.getFullName()))
          : afterElem
        return validElement === undefined ? undefined : [name, validElement]
      })
      .filter(values.isDefined)
      .fromPairs()
      .value()
  }

  const buildValidDiffGraph = (nodeIdsToOmit: Set<string>, validAfterElementsMap: ElementMap):
    DiffGraph<ChangeDataType> => {
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
    const validDiffGraph = new DataNodeMap<DiffNode<ChangeDataType>>()
    try {
      diffGraph.walkSync(nodeId => {
        const change = diffGraph.getData(nodeId)
        const { elemID } = getChangeElement(change)
        if (nodeIdsToOmit.has(elemID.getFullName())) {
          // in case this is an invalid node throw error so the walk will skip the dependent nodes
          throw new Error()
        }
        const validChange = replaceAfterElement(change)
        validDiffGraph.addNode(nodeId, diffGraph.get(nodeId), validChange)
      })
    } catch (e) {
      if (e instanceof WalkError && e.circularDependencyError === undefined) {
        // do nothing, we may have errors since we may skip nodes that depends on invalid nodes
        log.warn('removing the following changes from plan: %o', e.handlerErrors)
      } else {
        // If we get a different error or a circular dependency, we have to report the error here
        // If we silence the error here the rest of the code may succeed but with a partial plan
        // and the user will not be able to know why the plan is partial
        throw e
      }
    }
    return validDiffGraph
  }

  if (Object.keys(changeValidators).length === 0) {
    // Shortcut to avoid grouping all changes if there are no validators to run
    return { changeErrors: [], validDiffGraph: diffGraph }
  }

  const changesByAdapter = collections.iterable.groupBy(
    wu(diffGraph.keys()).map(changeId => diffGraph.getData(changeId)),
    change => getChangeElement(change).elemID.adapter,
  )

  const errorPromises = [...changesByAdapter.entries()]
    .filter(([adapter]) => adapter in changeValidators)
    .map(([adapter, changes]) => changeValidators[adapter](changes))

  const changeErrors = _.flatten(await Promise.all(errorPromises))

  const invalidChanges = changeErrors.filter(v => v.severity === 'Error')
  const nodeIdsToOmit = new Set(invalidChanges.map(change => change.elemID.getFullName()))
  const validAfterElementsMap = createValidAfterElementsMap(invalidChanges)
  const validDiffGraph = buildValidDiffGraph(nodeIdsToOmit, validAfterElementsMap)
  return { changeErrors, validDiffGraph }
}
