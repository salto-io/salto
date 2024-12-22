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
import { isInstanceOfTypeSync } from '../filters/utils'
import { FLOW_METADATA_TYPE, FLOW_NODE, TARGET_REFERENCE } from '../constants'

type ReferenceToElemId = {
  referenceOrName: string
  elemId: ElemID
  kind?: string
}

const isFlowNode = (fields: FieldMap): boolean => 'locationX' in fields && 'locationY' in fields

const getFlowNodesAndTargetReferences = (
  element: InstanceElement,
): { targetReferences: ReferenceToElemId[]; flowNodes: ReferenceToElemId[] } => {
  const flowNodes: ReferenceToElemId[] = []
  const targetReferences: ReferenceToElemId[] = []
  const findFlowNodesAndTargetReferences: TransformFuncSync = ({ value, path, field }) => {
    if (_.isUndefined(field) || _.isUndefined(path)) return value
    if (isFlowNode(field.parent.fields) && path.name === 'name' && _.isString(value)) {
      flowNodes.push({ referenceOrName: value, elemId: path, kind: FLOW_NODE })
    }
    if (path.name === 'targetReference' && _.isString(value)) {
      targetReferences.push({ referenceOrName: value, elemId: path, kind: TARGET_REFERENCE })
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

const getSymmetricDifference = ({
  targetReferences,
  flowNodes,
}: {
  targetReferences: ReferenceToElemId[]
  flowNodes: ReferenceToElemId[]
}): ReferenceToElemId[] => _.xorBy(flowNodes, targetReferences, 'referenceOrName')

const createMissingReferencedElementChangeError = (targetReference: ReferenceToElemId): ChangeError => ({
  elemID: targetReference.elemId,
  severity: 'Error',
  message: 'Reference to missing Flow Element',
  detailedMessage: `The Flow Element "${targetReference.referenceOrName}" does not exist.`,
})

const createUnreferencedElementChangeError = (flowNode: ReferenceToElemId): ChangeError => ({
  elemID: flowNode.elemId,
  severity: 'Info',
  message: 'Unused Flow Element',
  detailedMessage: `The Flow Element "${flowNode.referenceOrName}" isn’t being used in the Flow.`,
})

const createChangeError = (symmetricDifference: ReferenceToElemId[]): ChangeError[] =>
  symmetricDifference.map(referenceToElemId => {
    switch (referenceToElemId.kind) {
      case TARGET_REFERENCE:
        return createMissingReferencedElementChangeError(referenceToElemId)
      default:
        return createUnreferencedElementChangeError(referenceToElemId)
    }
  })

const changeValidator: ChangeValidator = async changes =>
  changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(isInstanceOfTypeSync(FLOW_METADATA_TYPE))
    .map(getFlowNodesAndTargetReferences)
    .map(getSymmetricDifference)
    .flatMap(createChangeError)

export default changeValidator
