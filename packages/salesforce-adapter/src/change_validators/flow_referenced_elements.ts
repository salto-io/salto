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
import { apiNameSync, isInstanceOfTypeSync } from '../filters/utils'
import {
  ELEMENT_REFERENCE,
  FLOW_ELEMENTS_WITH_UNIQUE_NAMES,
  FLOW_METADATA_TYPE,
  FLOW_NODE_FIELD_NAMES,
  LEFT_VALUE_REFERENCE,
  START_ELEMENT_REFERENCE,
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
  const extractFlowElementName = (value: string): string | undefined => {
    if (value.includes('$')) return undefined
    return value.includes('.') ? value.split('.')[0] : value
  }
  const findFlowElementsAndTargetReferences: TransformFuncSync = ({ value, path, field }) => {
    if (!field || !path || !_.isString(value)) return value
    switch (path.name) {
      case FLOW_NODE_FIELD_NAMES.NAME:
        if (isFlowNode(field.parent.fields)) {
          flowNodes[value] = path
        } else if (FLOW_ELEMENTS_WITH_UNIQUE_NAMES.includes(apiNameSync(field.parent) ?? '')) {
          flowElements[value] = path
        }
        break

      case START_ELEMENT_REFERENCE:
      case TARGET_REFERENCE:
        targetReferences.get(value).push(path)
        break

      case ELEMENT_REFERENCE:
      case LEFT_VALUE_REFERENCE: {
        const elemName = extractFlowElementName(value)
        if (elemName === undefined) break
        const referenceMap = path.name === ELEMENT_REFERENCE ? elementReferences : leftValueReferences
        referenceMap.get(elemName).push(path)
        break
      }
      default:
        break
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
  severity: 'Warning',
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
  const allReferences = [targetReferences, elementReferences, leftValueReferences].reduce((acc, refMap) => {
    refMap.forEach((value, key) => {
      acc.set(key, [...(acc.get(key) || []), ...value])
    })
    return acc
  }, new Map<string, ElemID[]>())
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
