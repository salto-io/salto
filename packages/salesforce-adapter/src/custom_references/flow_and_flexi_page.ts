/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  CORE_ANNOTATIONS,
  Element,
  ElemID,
  InstanceElement,
  isReferenceExpression,
  ReferenceExpression,
  ReferenceInfo,
  Value,
} from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { inspectValue, WALK_NEXT_STEP, walkOnElement, WalkOnFunc } from '@salto-io/adapter-utils'
import { WeakReferencesHandler } from '../types'
import { isInstanceOfTypeSync } from '../filters/utils'
import { API_NAME_SEPARATOR, FLEXI_PAGE_TYPE, FLOW_METADATA_TYPE } from '../constants'

const log = logger(module)
const { isDefined } = values

type ReferenceExtractor = (instance: InstanceElement) => ReferenceInfo[]

const instanceParentCache = new WeakMap<InstanceElement, ReferenceExpression>()

const getInstanceParent = (instance: InstanceElement): ReferenceExpression | undefined => {
  if (instanceParentCache.has(instance)) {
    return instanceParentCache.get(instance)
  }
  const parentRefs = instance.annotations[CORE_ANNOTATIONS.PARENT]
  if (parentRefs === undefined) {
    log.debug(`Missing Parent annotation in ${inspectValue(instance)}`)
    return undefined
  }
  const parentRef = parentRefs[0] as ReferenceExpression
  instanceParentCache.set(instance, parentRef)
  log.debug(
    `Found parent annotation for ${instance.elemID.getFullName()} using the first one ${inspectValue(parentRef)}`,
  )
  return parentRef
}

const recordPrefixes = ['$Record.', 'Record.']

const referenceInfoFromFieldValue = (
  instance: InstanceElement,
  path: ElemID,
  value: Value,
): ReferenceInfo[] | undefined => {
  if (isReferenceExpression(value)) return undefined
  if (recordPrefixes.some(prefix => value.startsWith(prefix))) {
    const parentRef = getInstanceParent(instance)
    if (parentRef === undefined) {
      return undefined
    }
    return [
      {
        source: path,
        target: parentRef.elemID.createNestedID('field', value.split(API_NAME_SEPARATOR)[1]),
        type: 'strong',
      },
    ]
  }
  return undefined
}

const flowCondition: ReferenceExtractor = (instance: InstanceElement) =>
  // FlowCondition.leftValueReference
  instance.value.decisions?.flatMap((flowDecision: Value, decisionIdx: number) =>
    flowDecision.rules?.flatMap((flowRule: Value, ruleIdx: number) =>
      flowRule.conditions?.flatMap((flowCond: Value, conditionIdx: number) =>
        referenceInfoFromFieldValue(
          instance,
          instance.elemID.createNestedID(
            'decisions',
            decisionIdx.toString(),
            'rules',
            ruleIdx.toString(),
            'conditions',
            conditionIdx.toString(),
            'leftValueReference',
          ),
          flowCond.leftValueReference,
        ),
      ),
    ),
  ) ?? []

const flowAssignmentItem: ReferenceExtractor = (instance: InstanceElement) =>
  // FlowAssignmentItem.assignToReference
  instance.value.assignments?.flatMap((assignment: Value, assignmentIdx: number) =>
    assignment.assignmentItems?.flatMap((assignmentItem: Value, itemIdx: number) =>
      referenceInfoFromFieldValue(
        instance,
        instance.elemID.createNestedID(
          'assignments',
          assignmentIdx.toString(),
          'assignmentItems',
          itemIdx.toString(),
          'assignToReference',
        ),
        assignmentItem.assignToReference,
      ),
    ),
  ) ?? []

const flowElementReferenceOrValue: ReferenceExtractor = (instance: InstanceElement) => {
  // FlowElementReferenceOrValue.elementReference
  const result: ReferenceInfo[] = []
  const walkOnFunc: WalkOnFunc = ({ value, path }) => {
    if (path === undefined || path.name !== 'elementReference') return WALK_NEXT_STEP.RECURSE
    const newRef = referenceInfoFromFieldValue(instance, path, value)
    if (newRef !== undefined) {
      result.push(...newRef)
    }
    return WALK_NEXT_STEP.SKIP
  }
  walkOnElement({ element: instance, func: walkOnFunc })
  return result
}

const uiFormulaCriterion: ReferenceExtractor = (instance: InstanceElement) => {
  // UiFormulaCriterion.leftValue
  const result: ReferenceInfo[] = []
  const walkOnFunc: WalkOnFunc = ({ value, path }) => {
    if (path === undefined || path.name !== 'leftValue') return WALK_NEXT_STEP.RECURSE
    const newRef = referenceInfoFromFieldValue(instance, path, value)
    if (newRef !== undefined) {
      result.push(...newRef)
    }
    return WALK_NEXT_STEP.SKIP
  }
  walkOnElement({ element: instance, func: walkOnFunc })
  return result
}

const referenceExtractors: Record<string, ReadonlyArray<ReferenceExtractor>> = {
  [FLOW_METADATA_TYPE]: [flowCondition, flowAssignmentItem, flowElementReferenceOrValue],
  [FLEXI_PAGE_TYPE]: [uiFormulaCriterion],
}

const findWeakReferences: WeakReferencesHandler['findWeakReferences'] = async (
  elements: Element[],
): Promise<ReferenceInfo[]> => {
  const fetchedInstances = elements.filter(isInstanceOfTypeSync(...Object.keys(referenceExtractors)))
  return fetchedInstances.flatMap(instance =>
    referenceExtractors[instance.elemID.typeName].flatMap(refExtractor => {
      try {
        const addedCustomReferences = refExtractor(instance).filter(isDefined)
        if (addedCustomReferences.length > 0) {
          log.debug(
            `added custom references to ${instance.elemID.getFullName()} at ${refExtractor.name}: ${inspectValue(addedCustomReferences)}`,
          )
        }
        return addedCustomReferences
      } catch (error) {
        log.error('Failed to generate custom references from formula fields: %s', error)
        return []
      }
    }),
  )
}

export const formulaRefsHandler: WeakReferencesHandler = {
  findWeakReferences,
  removeWeakReferences: () => async () => ({ fixedElements: [], errors: [] }),
}
