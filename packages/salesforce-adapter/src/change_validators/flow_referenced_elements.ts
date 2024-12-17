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
} from '@salto-io/adapter-api'
import { WALK_NEXT_STEP, walkOnElement, WalkOnFunc } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { isInstanceOfTypeSync } from '../filters/utils'
import { FLOW_METADATA_TYPE } from '../constants'

type FlowConnector = {
  targetReference: string
}

type FlowElement = {
  name: string
}

const isFlowConnector = (value: unknown): value is FlowConnector =>
  _.isObject(value) && _.isString(_.get(value, 'targetReference'))

const hasProcessMetadataValues = (instance: InstanceElement): boolean => {
  const { processMetadataValues } = instance.getTypeSync().fields
  return _.isArray(processMetadataValues)
}

const isFlowElement = (value: unknown): value is FlowElement => _.isObject(value) && _.isString(_.get(value, 'name'))

const getTargetReferences = (element: InstanceElement): Set<string> => {
  const targetReferences = new Set<string>()
  const findFlowConnectors: WalkOnFunc = ({ value }) => {
    if (hasProcessMetadataValues(value) && isFlowConnector(value)) {
      targetReferences.add(value.targetReference)
      return WALK_NEXT_STEP.SKIP
    }
    return WALK_NEXT_STEP.RECURSE
  }
  walkOnElement({ element, func: findFlowConnectors })
  return targetReferences
}

const getFlowElements = (element: InstanceElement): { flowElements: Set<string>; duplicates: Set<string> } => {
  const flowElements = new Set<string>()
  const duplicates = new Set<string>()
  const findFlowElements: WalkOnFunc = ({ value }) => {
    if (isFlowElement(value)) {
      if (flowElements.has(value.name)) {
        duplicates.add(value.name)
      }
      flowElements.add(value.name)
    }
    return WALK_NEXT_STEP.RECURSE
  }
  walkOnElement({ element, func: findFlowElements })
  return { flowElements, duplicates }
}

const hasMissingReferencedElements = (targetReferences: Set<string>, flowElements: Set<string>): boolean =>
  ![...targetReferences].every(targetReference => flowElements.has(targetReference))

const hasFlowReferenceError = ({
  targetReferences,
  flowElements,
  duplicates,
}: {
  targetReferences: Set<string>
  flowElements: Set<string>
  duplicates: Set<string>
}): boolean => hasMissingReferencedElements(targetReferences, flowElements) || duplicates.size > 0

const getElemIDFlowElementsTargetReferencesAndDuplicates = (
  instance: InstanceElement,
): { elemId: ElemID; targetReferences: Set<string>; flowElements: Set<string>; duplicates: Set<string> } => {
  const targetReferences = getTargetReferences(instance)
  const { flowElements, duplicates } = getFlowElements(instance)
  const elemId = instance.elemID
  return { elemId, targetReferences, flowElements, duplicates }
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

const createDuplicateFlowElementChangeError = (duplicates: Set<string>, elemId: ElemID): ChangeError => {
  const duplicateList = Array.from(duplicates)
    .map(dup => `- ${dup}`)
    .join('\n')
  return {
    elemID: elemId,
    severity: 'Error',
    message: 'Flow instance has conflicting flow element definitions',
    detailedMessage: `The following flow elements have multiple definitions:\n${duplicateList}`,
  }
}

const createChangeError = ({
  elemId,
  targetReferences,
  flowElements,
  duplicates,
}: {
  elemId: ElemID
  targetReferences: Set<string>
  flowElements: Set<string>
  duplicates: Set<string>
}): ChangeError[] => {
  const errors: ChangeError[] = []
  const isReferenceToMissingElement = (reference: string): boolean => flowElements.has(reference)
  const missingReferencedElementsErrors: string[] = Array.from(targetReferences).filter(isReferenceToMissingElement)
  errors.concat(createMissingReferencedElementChangeError(missingReferencedElementsErrors, elemId))
  errors.concat(createDuplicateFlowElementChangeError(duplicates, elemId))
  return errors
}

const changeValidator: ChangeValidator = async changes => {
  const changeErrors: ChangeError[] = []
  changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(isInstanceOfTypeSync(FLOW_METADATA_TYPE))
    .map(getElemIDFlowElementsTargetReferencesAndDuplicates)
    .filter(hasFlowReferenceError)
    .map(createChangeError)
  return changeErrors
}

export default changeValidator
