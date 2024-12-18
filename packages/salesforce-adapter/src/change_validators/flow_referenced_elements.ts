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

const getFlowNodes = (element: InstanceElement): Set<string> => {
  const flowNodes = new Set<string>()
  const findFlowNodes: TransformFuncSync = ({ value, path, field }) => {
    if (!field || !path) return value
    if (isFlowNodeName(value, path, field.parent)) {
      flowNodes.add(value)
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

const getTargetReferences = (element: InstanceElement): Set<string> => {
  const targetReferences = new Set<string>()
  const findFlowConnectors: WalkOnFunc = ({ value, path }) => {
    if (isTargetReference(value, path)) {
      targetReferences.add(value)
      return WALK_NEXT_STEP.SKIP
    }
    return WALK_NEXT_STEP.RECURSE
  }
  walkOnElement({ element, func: findFlowConnectors })
  return targetReferences
}

const hasMissingReferencedElements = (targetReferences: Set<string>, flowNodes: Set<string>): boolean =>
  ![...targetReferences].every(targetReference => flowNodes.has(targetReference))

const hasUnreferencedElements = (targetReferences: Set<string>, flowNodes: Set<string>): boolean =>
  ![...flowNodes].every(flowNode => targetReferences.has(flowNode))

const hasFlowReferenceError = ({
  targetReferences,
  flowNodes,
}: {
  targetReferences: Set<string>
  flowNodes: Set<string>
}): boolean =>
  hasMissingReferencedElements(targetReferences, flowNodes) || hasUnreferencedElements(targetReferences, flowNodes)

const getElemIDFlowNodesAndTargetReferences = (
  instance: InstanceElement,
): { elemId: ElemID; targetReferences: Set<string>; flowNodes: Set<string> } => {
  const targetReferences = getTargetReferences(instance)
  const flowNodes = getFlowNodes(instance)
  const elemId = instance.elemID
  return { elemId, targetReferences, flowNodes }
}

const createMissingReferencedElementChangeError = (targetReferences: string[], elemId: ElemID): ChangeError => {
  const referenceList = targetReferences.map(ref => `- ${ref}`).join('\n')
  return {
    elemID: elemId,
    severity: 'Error',
    message: 'Flow instance has references to missing flow elements',
    detailedMessage: `The following references are pointing to non existing flow elements:\n${referenceList}`,
  }
}

const createUnreferencedElementChangeError = (flowNodes: string[], elemId: ElemID): ChangeError => {
  const nodeList = flowNodes.map(ref => `- ${ref}`).join('\n')
  return {
    elemID: elemId,
    severity: 'Info',
    message: 'Flow instance has elements that are never referenced',
    detailedMessage: `The following elements has no references:\n${nodeList}`,
  }
}

const createChangeError = ({
  elemId,
  targetReferences,
  flowNodes,
}: {
  elemId: ElemID
  targetReferences: Set<string>
  flowNodes: Set<string>
}): ChangeError[] => {
  const errors: ChangeError[] = []
  const isReferenceToMissingElement = (reference: string): boolean => !flowNodes.has(reference)
  const missingReferencedElementsErrors: string[] = Array.from(targetReferences).filter(isReferenceToMissingElement)
  const isUnreferencedElement = (reference: string): boolean => !targetReferences.has(reference)
  const unreferencedElementsErrors: string[] = Array.from(flowNodes).filter(isUnreferencedElement)
  if (missingReferencedElementsErrors.length > 0) {
    errors.push(createMissingReferencedElementChangeError(missingReferencedElementsErrors, elemId))
  }
  if (unreferencedElementsErrors.length > 0) {
    errors.push(createUnreferencedElementChangeError(unreferencedElementsErrors, elemId))
  }
  return errors
}

const changeValidator: ChangeValidator = async changes =>
  changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(isInstanceOfTypeSync(FLOW_METADATA_TYPE))
    .map(getElemIDFlowNodesAndTargetReferences)
    .filter(hasFlowReferenceError)
    .flatMap(createChangeError)

export default changeValidator
