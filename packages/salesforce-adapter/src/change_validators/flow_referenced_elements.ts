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
  FieldMap,
} from '@salto-io/adapter-api'
import { TransformFuncSync, transformValuesSync } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { isInstanceOfTypeSync } from '../filters/utils'
import { FLOW_METADATA_TYPE, FLOW_NODE_FIELD_NAMES, TARGET_REFERENCE } from '../constants'

const { DefaultMap } = collections.map

const isFlowNode = (fields: FieldMap): boolean =>
  FLOW_NODE_FIELD_NAMES.LOCATION_X in fields && FLOW_NODE_FIELD_NAMES.LOCATION_Y in fields

const getFlowNodesAndTargetReferences = (
  element: InstanceElement,
): { targetReferences: Map<string, ElemID[]>; flowNodes: Record<string, ElemID> } => {
  const flowNodes: Record<string, ElemID> = {}
  const targetReferences = new DefaultMap<string, ElemID[]>(() => [])
  const findFlowNodesAndTargetReferences: TransformFuncSync = ({ value, path, field }) => {
    if (_.isUndefined(field) || _.isUndefined(path)) return value
    if (isFlowNode(field.parent.fields) && path.name === FLOW_NODE_FIELD_NAMES.NAME && _.isString(value)) {
      flowNodes[value] = path
    }
    if (path.name === TARGET_REFERENCE && _.isString(value)) {
      targetReferences.get(value).push(path)
    }
    return value
  }
  transformValuesSync({
    values: element.value,
    pathID: element.elemID,
    type: element.getTypeSync(),
    transformFunc: findFlowNodesAndTargetReferences,
  })
  return { flowNodes, targetReferences }
}

const getUnusedElementsAndMissingReferences = ({
  flowNodes,
  targetReferences,
}: {
  flowNodes: Record<string, ElemID>
  targetReferences: Map<string, ElemID[]>
}): { unusedElements: Record<string, ElemID>; missingReferences: Map<string, ElemID[]> } => {
  const unusedElements: Record<string, ElemID> = {}
  const missingReferences = new DefaultMap<string, ElemID[]>(() => [])
  Object.keys(flowNodes).forEach(elem => {
    if (!targetReferences.has(elem)) unusedElements[elem] = flowNodes[elem]
  })
  targetReferences.forEach((elemId, elem) => {
    if (_.isUndefined(flowNodes[elem])) missingReferences.set(elem, elemId)
  })
  return { unusedElements, missingReferences }
}

const createMissingReferencedElementChangeError = (elemId: ElemID, elemName: string): ChangeError => ({
  elemID: elemId,
  severity: 'Error',
  message: 'Reference to missing Flow Element',
  detailedMessage: `The Flow Element "${elemName}" does not exist.`,
})

const createUnusedElementChangeError = (elemId: ElemID, elemName: string): ChangeError => ({
  elemID: elemId,
  severity: 'Info',
  message: 'Unused Flow Element',
  detailedMessage: `The Flow Element "${elemName}" isn’t being used in the Flow.`,
})

const createChangeError = ({
  unusedElements,
  missingReferences,
}: {
  unusedElements: Record<string, ElemID>
  missingReferences: Map<string, ElemID[]>
}): ChangeError[] => {
  const unusedElementErrors = Object.entries(unusedElements).map(([name, elemId]) =>
    createUnusedElementChangeError(elemId, name),
  )
  const missingReferenceErrors = Array.from(missingReferences.entries()).flatMap(([name, elemIds]) =>
    elemIds.map(elemId => createMissingReferencedElementChangeError(elemId, name)),
  )
  return [...unusedElementErrors, ...missingReferenceErrors]
}
const changeValidator: ChangeValidator = async changes =>
  changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(isInstanceOfTypeSync(FLOW_METADATA_TYPE))
    .map(getFlowNodesAndTargetReferences)
    .map(getUnusedElementsAndMissingReferences)
    .flatMap(createChangeError)

export default changeValidator
