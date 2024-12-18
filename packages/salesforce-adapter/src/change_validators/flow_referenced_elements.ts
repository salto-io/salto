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

const isFlowElement = (fields: FieldMap): boolean => 'processMetadataValues' in fields

const isFlowElementName = (value: unknown, path: ElemID, parent: ObjectType): value is string =>
  isFlowElement(parent.fields) && path.name === 'name' && _.isString(value)

const getFlowElements = (element: InstanceElement): Set<string> => {
  const flowElements = new Set<string>()
  const findFlowElements: TransformFuncSync = ({ value, path, field }) => {
    if (!field || !path) return value
    if (isFlowElementName(value, path, field.parent)) {
      flowElements.add(value)
    }
    return value
  }
  transformValuesSync({
    values: element.value,
    pathID: element.elemID,
    type: element.getTypeSync(),
    transformFunc: findFlowElements,
  })
  return flowElements
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

const hasMissingReferencedElements = (targetReferences: Set<string>, flowElements: Set<string>): boolean =>
  ![...targetReferences].every(targetReference => flowElements.has(targetReference))

const hasFlowReferenceError = ({
  targetReferences,
  flowElements,
}: {
  targetReferences: Set<string>
  flowElements: Set<string>
}): boolean => hasMissingReferencedElements(targetReferences, flowElements)

const getElemIDFlowElementsAndTargetReferences = (
  instance: InstanceElement,
): { elemId: ElemID; targetReferences: Set<string>; flowElements: Set<string> } => {
  const targetReferences = getTargetReferences(instance)
  const flowElements = getFlowElements(instance)
  const elemId = instance.elemID
  return { elemId, targetReferences, flowElements }
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

const createChangeError = ({
  elemId,
  targetReferences,
  flowElements,
}: {
  elemId: ElemID
  targetReferences: Set<string>
  flowElements: Set<string>
}): ChangeError[] => {
  const errors: ChangeError[] = []
  const isReferenceToMissingElement = (reference: string): boolean => !flowElements.has(reference)
  const missingReferencedElementsErrors: string[] = Array.from(targetReferences).filter(isReferenceToMissingElement)
  if (missingReferencedElementsErrors.length > 0) {
    errors.push(createMissingReferencedElementChangeError(missingReferencedElementsErrors, elemId))
  }
  return errors
}

const changeValidator: ChangeValidator = async changes =>
  changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(isInstanceOfTypeSync(FLOW_METADATA_TYPE))
    .map(getElemIDFlowElementsAndTargetReferences)
    .filter(hasFlowReferenceError)
    .flatMap(createChangeError)

export default changeValidator
