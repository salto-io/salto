/*
 * Copyright 2025 Salto Labs Ltd.
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
import {
  ELEMENT_REFERENCE,
  FLOW_ELEMENTS_WITH_NONUNIQUE_NAMES,
  FLOW_METADATA_TYPE,
  FLOW_NODE_FIELD_NAMES,
  LEFT_VALUE_REFERENCE,
  TARGET_REFERENCE,
} from '../constants'

const { DefaultMap } = collections.map

const isFlowNode = (fields: FieldMap): boolean =>
  FLOW_NODE_FIELD_NAMES.LOCATION_X in fields && FLOW_NODE_FIELD_NAMES.LOCATION_Y in fields

const getFlowElementsAndReferences = (
  element: InstanceElement,
): {
  flowNodes: Record<string, ElemID>
  flowElements: Record<string, ElemID>
  targetReferences: Map<string, ElemID[]>
  elementReferences: Map<string, ElemID[]>
  leftValueReferences: Map<string, ElemID[]>
} => {
  const flowNodes: Record<string, ElemID> = {}
  const flowElements: Record<string, ElemID> = {}
  const targetReferences = new DefaultMap<string, ElemID[]>(() => [])
  const elementReferences = new DefaultMap<string, ElemID[]>(() => [])
  const leftValueReferences = new DefaultMap<string, ElemID[]>(() => [])
  const findFlowElementsAndTargetReferences: TransformFuncSync = ({ value, path, field }) => {
    if (_.isUndefined(field) || _.isUndefined(path)) return value
    if (
      !FLOW_ELEMENTS_WITH_NONUNIQUE_NAMES.includes(field.elemID.typeName) &&
      path.name === FLOW_NODE_FIELD_NAMES.NAME &&
      _.isString(value)
    ) {
      if (isFlowNode(field.parent.fields)) flowNodes[value] = path
      else flowElements[value] = path
    }
    if (path.name === TARGET_REFERENCE && _.isString(value)) {
      targetReferences.get(value).push(path)
    }
    if (path.name === ELEMENT_REFERENCE && _.isString(value)) {
      const elemName = value.includes('.') ? value.split('.')[0] : value
      elementReferences.get(elemName).push(path)
    }
    if (path.name === LEFT_VALUE_REFERENCE && _.isString(value)) {
      const elemName = value.includes('.') ? value.split('.')[0] : value
      leftValueReferences.get(elemName).push(path)
    }
    return value
  }
  transformValuesSync({
    values: element.value,
    pathID: element.elemID,
    type: element.getTypeSync(),
    transformFunc: findFlowElementsAndTargetReferences,
  })
  return { flowNodes, flowElements, targetReferences, elementReferences, leftValueReferences }
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

const createChangeErrors = ({
  flowNodes,
  flowElements,
  targetReferences,
  elementReferences,
  leftValueReferences,
}: {
  flowNodes: Record<string, ElemID>
  flowElements: Record<string, ElemID>
  targetReferences: Map<string, ElemID[]>
  elementReferences: Map<string, ElemID[]>
  leftValueReferences: Map<string, ElemID[]>
}): ChangeError[] => {
  const unusedElements: Record<string, ElemID> = {}
  const missingReferences = new DefaultMap<string, ElemID[]>(() => [])
  const allFlowElements = { ...flowNodes, ...flowElements }
  const allReferences = new Map([
    ...targetReferences.entries(),
    ...elementReferences.entries(),
    ...leftValueReferences.entries(),
  ])
  Object.keys(flowNodes).forEach(elem => {
    if (!targetReferences.has(elem)) unusedElements[elem] = flowNodes[elem]
  })
  allReferences.forEach((elemId, elem) => {
    if (_.isUndefined(allFlowElements[elem])) missingReferences.set(elem, elemId)
  })
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
    .map(getFlowElementsAndReferences)
    .flatMap(createChangeErrors)

export default changeValidator
