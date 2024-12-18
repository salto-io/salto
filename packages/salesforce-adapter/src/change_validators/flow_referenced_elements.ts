/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  ChangeValidator,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceChange,
  InstanceElement,
  ChangeError,
  ElemID,
  ObjectType,
  FieldMap,
} from '@salto-io/adapter-api'
import {
  TransformFuncSync,
  transformValuesSync,
  WALK_NEXT_STEP,
  walkOnElement,
  WalkOnFunc,
} from '@salto-io/adapter-utils'
import _ from 'lodash'
import { isInstanceOfTypeSync } from '../filters/utils'
import { FLOW_METADATA_TYPE } from '../constants'

const isFlowNode = (fields: FieldMap): boolean => 'locationX' in fields && 'locationY' in fields

const isFlowNodeName = (value: unknown, path: ElemID, parent: ObjectType): value is string =>
  isFlowNode(parent.fields) && path.name === 'name' && _.isString(value)

const getFlowNodes = (element: InstanceElement): Map<string, ElemID> => {
  const flowNodes = new Map<string, ElemID>()
  const findFlowNodes: TransformFuncSync = ({ value, path, field }) => {
    if (!field || !path) return value
    if (isFlowNodeName(value, path, field.parent)) {
      flowNodes.set(value, path)
    }
    return value
  }
  transformValuesSync({
    values: element.value,
    pathID: element.elemID,
    type: element.getTypeSync(),
    transformFunc: findFlowNodes,
  })
  return flowNodes
}

const isTargetReference = (value: unknown, path: ElemID): value is string =>
  path.name === 'targetReference' && _.isString(value)

const getTargetReferences = (element: InstanceElement): Map<string, ElemID> => {
  const targetReferences = new Map<string, ElemID>()
  const findFlowConnectors: WalkOnFunc = ({ value, path }) => {
    if (isTargetReference(value, path)) {
      targetReferences.set(value, path)
      return WALK_NEXT_STEP.SKIP
    }
    return WALK_NEXT_STEP.RECURSE
  }
  walkOnElement({ element, func: findFlowConnectors })
  return targetReferences
}

const hasMissingReferencedElements = (targetReferences: string[], flowNodes: string[]): boolean =>
  !targetReferences.every(targetReference => targetReference in flowNodes)

const hasUnreferencedElements = (targetReferences: string[], flowNodes: string[]): boolean =>
  !flowNodes.every(flowNode => flowNode in targetReferences)

const hasFlowReferenceError = ({
  targetReferences,
  flowNodes,
}: {
  targetReferences: Map<string, ElemID>
  flowNodes: Map<string, ElemID>
}): boolean =>
  hasMissingReferencedElements(Array.from(targetReferences.keys()), Array.from(flowNodes.keys())) ||
  hasUnreferencedElements(Array.from(targetReferences.keys()), Array.from(flowNodes.keys()))

const getFlowNodesAndTargetReferences = (
  instance: InstanceElement,
): { targetReferences: Map<string, ElemID>; flowNodes: Map<string, ElemID> } => {
  const targetReferences = getTargetReferences(instance)
  const flowNodes = getFlowNodes(instance)
  return { targetReferences, flowNodes }
}

const createMissingReferencedElementChangeError = (targetReference: string, elemId: ElemID): ChangeError => ({
  elemID: elemId,
  severity: 'Error',
  message: 'Flow instance has references to missing flow nodes',
  detailedMessage: `${targetReference} is referencing a non-existing flow node.\n`,
})

const createUnreferencedElementChangeError = (flowNode: string, elemId: ElemID): ChangeError => ({
  elemID: elemId,
  severity: 'Info',
  message: 'Flow instance has flow nodes that are not referenced',
  detailedMessage: `${flowNode} is not referenced anywhere in the flow.`,
})

const createChangeError = ({
  targetReferences,
  flowNodes,
}: {
  targetReferences: Map<string, ElemID>
  flowNodes: Map<string, ElemID>
}): ChangeError[] => {
  const errors: ChangeError[] = []
  const isReferenceToMissingElement = ([reference, _elemId]: [string, ElemID]): boolean => !flowNodes.has(reference)
  const missingReferencedElementsErrors = Array.from(targetReferences).filter(isReferenceToMissingElement)
  const isUnreferencedElement = ([reference, _elemId]: [string, ElemID]): boolean => !targetReferences.has(reference)
  const unreferencedElementsErrors = Array.from(flowNodes).filter(isUnreferencedElement)
  if (missingReferencedElementsErrors.length > 0) {
    missingReferencedElementsErrors.forEach(([targetReference, elemId]) =>
      errors.push(createMissingReferencedElementChangeError(targetReference, elemId)),
    )
  }
  if (unreferencedElementsErrors.length > 0) {
    unreferencedElementsErrors.forEach(([flowNode, elemId]) =>
      errors.push(createUnreferencedElementChangeError(flowNode, elemId)),
    )
  }
  return errors
}

const changeValidator: ChangeValidator = async changes =>
  changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(isInstanceOfTypeSync(FLOW_METADATA_TYPE))
    .map(getFlowNodesAndTargetReferences)
    .filter(hasFlowReferenceError)
    .flatMap(createChangeError)

export default changeValidator
