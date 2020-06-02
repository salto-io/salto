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

import { DataNodeMap, Group, NodeId } from '@salto-io/dag'
import {
  ChangeError, Change, ElementMap, InstanceElement, TypeElement, ChangeValidator, getChangeElement,
  ElemID, ObjectType, ChangeDataType, isRemovalDiff, Element,
} from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import { buildGroupedGraphFromDiffGraph, getOrCreateGroupLevelChange } from './group'

type FilterResult = {
  changeErrors: ChangeError[]
  validDiffGraph: DataNodeMap<Change>
  validAfterElementsMap: ElementMap
}

type TopLevelElement = InstanceElement | TypeElement

export const filterInvalidChanges = async (
  beforeElementsMap: ElementMap,
  afterElementsMap: ElementMap,
  diffGraph: DataNodeMap<Change>,
  changeValidators: Record<string, ChangeValidator>,
): Promise<FilterResult> => {
  const validateChanges = async (groupLevelChange: Change, group: Group<Change>):
    Promise<ReadonlyArray<ChangeError>> => {
    const changeValidator = changeValidators[getChangeElement(groupLevelChange).elemID.adapter]
    if (_.isUndefined(changeValidator)) {
      return []
    }
    switch (groupLevelChange.action) {
      case 'modify':
        return changeValidator.onUpdate([...group.items.values()])
      case 'remove':
        return changeValidator.onRemove(getChangeElement(groupLevelChange))
      case 'add':
        return changeValidator.onAdd(getChangeElement(groupLevelChange))
      default:
        throw new Error('Unknown action type')
    }
  }

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
    // ObjectType's fields changes
    const beforeObj = beforeTopLevelElem as ObjectType
    const afterObj = afterTopLevelElem as ObjectType
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
      annotationTypes: _.clone(afterObj.annotationTypes),
      annotations: _.cloneDeep(afterObj.annotations),
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
      .filter(elem => elem !== undefined)
      .fromPairs()
      .value()
  }

  const buildValidDiffGraph = (nodeIdsToOmit: Set<string>, validAfterElementsMap: ElementMap):
    DataNodeMap<Change<ChangeDataType>> => {
    const validDiffGraph = new DataNodeMap<Change<ChangeDataType>>()
    try {
      diffGraph.walkSync(nodeId => {
        const change = diffGraph.getData(nodeId)
        const { elemID } = getChangeElement(change)
        if (nodeIdsToOmit.has(elemID.getFullName())) {
          // in case this is an invalid node throw error so the walk will skip the dependent nodes
          throw new Error()
        }
        const validChange = isRemovalDiff(change) ? change : { ...change,
          data: {
            ...change.data,
            after: validAfterElementsMap[elemID.getFullName()] || change.data.after,
          } } as Change<ChangeDataType>
        validDiffGraph.addNode(nodeId, diffGraph.get(nodeId), validChange)
      })
    } catch (e) {
      // do nothing, we may have errors since we may skip nodes that depends on invalid nodes
    }
    return validDiffGraph
  }

  const groupedGraph = buildGroupedGraphFromDiffGraph(diffGraph)
  const changeErrors: ChangeError[] = _.flatten(await Promise.all(
    wu(groupedGraph.keys())
      .map((groupId: NodeId) => {
        const group = groupedGraph.getData(groupId)
        const groupLevelChange = getOrCreateGroupLevelChange(group, beforeElementsMap,
          afterElementsMap)
        return validateChanges(groupLevelChange, group)
      })
  ))

  const invalidChanges = changeErrors.filter(v => v.severity === 'Error')
  const nodeIdsToOmit = new Set(invalidChanges.map(change => change.elemID.getFullName()))
  const validAfterElementsMap = createValidAfterElementsMap(invalidChanges)
  const validDiffGraph = buildValidDiffGraph(nodeIdsToOmit, validAfterElementsMap)
  return { changeErrors, validDiffGraph, validAfterElementsMap }
}
