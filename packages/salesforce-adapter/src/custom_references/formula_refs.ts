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
  ReferenceInfo,
  Value,
} from '@salto-io/adapter-api'
// import { parseFormulaIdentifier } from '@salto-io/salesforce-formula-parser'
import { values } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { inspectValue } from '@salto-io/adapter-utils'
import { WeakReferencesHandler } from '../types'
import { isInstanceOfTypeSync } from '../filters/utils'
import { API_NAME_SEPARATOR, SALESFORCE } from '../constants'

const log = logger(module)
const { isDefined } = values

type ReferenceExtractor = (instance: InstanceElement) => ReferenceInfo[]

const referenceInfoFromFieldValue = (
  instance: InstanceElement,
  path: ElemID,
  value: Value,
): ReferenceInfo[] | undefined => {
  if (isReferenceExpression(value)) return undefined
  if (value.startsWith('$Record.')) {
    if (instance.annotations[CORE_ANNOTATIONS.PARENT] === undefined) {
      log.debug(`Missing Parent annotation in ${inspectValue(instance)}`)
    }
    return [
      {
        source: path,
        target: new ElemID(
          SALESFORCE,
          instance.annotations[CORE_ANNOTATIONS.PARENT][0].elemID.typeName,
          value.split(API_NAME_SEPARATOR)[1],
        ),
        type: 'strong',
      },
    ]
  }
  // const identifierInfo = parseValue(value, instance.elemID.typeName)
  // const referenceElemIds = referencesFromIdentifiers(identifierInfo)

  // const referencesToOtherTypes = referenceElemIds.filter(ref => ref.typeName !== instance.elemID.typeName)

  return undefined
}

const flowCondition: ReferenceExtractor = (instance: InstanceElement) =>
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

const flowTestCondition: ReferenceExtractor = (instance: InstanceElement) =>
  instance.value.testPoints?.flatMap((testPoint: Value, pointIdx: number) =>
    testPoint.assertions?.flatMap((assertion: Value, assertionIdx: number) =>
      assertion.conditions?.flatMap((condition: Value, conditionIdx: number) =>
        referenceInfoFromFieldValue(
          instance,
          instance.elemID.createNestedID(
            'testPoints',
            pointIdx.toString(),
            'assertions',
            assertionIdx.toString(),
            'conditions',
            conditionIdx.toString(),
            'leftValueReference',
          ),
          condition.leftValueReference,
        ),
      ),
    ),
  ) ?? []

const flowTestParameter: ReferenceExtractor = (instance: InstanceElement) =>
  // FlowTestParameter.leftValueReference
  instance.value.testPoints?.flatMap((testPoint: Value, pointIdx: number) =>
    testPoint.parameters?.flatMap((parameter: Value, parameterIdx: number) =>
      referenceInfoFromFieldValue(
        instance,
        instance.elemID.createNestedID(
          'testPoints',
          pointIdx.toString(),
          'parameters',
          parameterIdx.toString(),
          'leftValueReference',
        ),
        parameter.leftValueReference,
      ),
    ),
  ) ?? []

const referenceExtractors: Record<string, ReadonlyArray<ReferenceExtractor>> = {
  Flow: [flowCondition, flowAssignmentItem],
  FlowTest: [flowTestCondition, flowTestParameter],
}

const findWeakReferences: WeakReferencesHandler['findWeakReferences'] = async (
  elements: Element[],
): Promise<ReferenceInfo[]> => {
  const fetchedInstances = elements.filter(isInstanceOfTypeSync(...Object.keys(referenceExtractors)))
  try {
    const addedCustomReferences = fetchedInstances.flatMap(instance =>
      referenceExtractors[instance.elemID.typeName].flatMap(refExtractor => refExtractor(instance).filter(isDefined)),
    )
    console.log(addedCustomReferences)
    return addedCustomReferences
  } catch (error) {
    log.error('Failed to generate custom references from formula fields: %s', error)
    return []
  }
}

export const formulaRefsHandler: WeakReferencesHandler = {
  findWeakReferences,
  removeWeakReferences: () => async () => ({ fixedElements: [], errors: [] }),
}
