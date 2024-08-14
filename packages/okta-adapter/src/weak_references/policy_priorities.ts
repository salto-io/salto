/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  GetCustomReferencesFunc,
  InstanceElement,
  ReferenceInfo,
  isInstanceElement,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { POLICY_PRIORITY_TYPE_NAMES, POLICY_RULE_PRIORITY_TYPE_NAMES } from '../constants'
import { WeakReferencesHandler } from './weak_references_handler'

const { awu } = collections.asynciterable

const log = logger(module)
const getInstanceAttribute = (instance: InstanceElement): string =>
  POLICY_RULE_PRIORITY_TYPE_NAMES.includes(instance.elemID.typeName) ? 'rules' : 'policies'

const markInstancesAsWeakReference = async (instance: InstanceElement): Promise<ReferenceInfo[]> => {
  const { priorities } = instance.value
  if (priorities === undefined || !Array.isArray(priorities)) {
    // priorities can be undefined if their are not custom instances (policies or rules)
    log.trace(
      `priorities value is undefined or not an array in instance ${instance.elemID.getFullName()}, hence not calculating rules weak references`,
    )
    return []
  }

  return awu(priorities)
    .map(async (ref, index) =>
      isReferenceExpression(ref)
        ? {
            source: instance.elemID.createNestedID('priorities', index.toString()),
            target: ref.elemID,
            type: 'weak' as const,
          }
        : undefined,
    )
    .filter(values.isDefined)
    .toArray()
}

/**
 * Marks each instance reference in policyPriority as a weak reference.
 */
const getPolicyPriorityReferences: GetCustomReferencesFunc = async elements =>
  awu(elements)
    .filter(isInstanceElement)
    .filter(instance =>
      POLICY_RULE_PRIORITY_TYPE_NAMES.concat(POLICY_PRIORITY_TYPE_NAMES).includes(instance.elemID.typeName),
    )
    .flatMap(markInstancesAsWeakReference)
    .toArray()

/*
 * Since we can implement a priority order for a portion of the instances (policies and rules),
 * We removing invalid instances (those not referenced or missing references) from priority instances.
 */
const removeMissingPriorities: WeakReferencesHandler['removeWeakReferences'] =
  ({ elementsSource }) =>
  async elements => {
    const fixedElements = await awu(elements)
      .filter(isInstanceElement)
      .filter(instance =>
        POLICY_RULE_PRIORITY_TYPE_NAMES.concat(POLICY_PRIORITY_TYPE_NAMES).includes(instance.elemID.typeName),
      )
      .map(async instance => {
        const { priorities } = instance.value
        if (priorities === undefined) {
          return undefined
        }
        const fixedInstance = instance.clone()
        fixedInstance.value.priorities = await awu(priorities)
          .filter(
            async ref =>
              ref !== undefined &&
              isReferenceExpression(ref) &&
              // eslint-disable-next-line no-return-await
              (await elementsSource.has(ref.elemID)),
          )
          .toArray()

        if (fixedInstance.value.priorities.length === instance.value.priorities.length) {
          return undefined
        }

        return fixedInstance
      })
      .filter(values.isDefined)
      .toArray()

    const errors = fixedElements.map(instance => ({
      elemID: instance.elemID.createNestedID('priorities'),
      severity: 'Info' as const,
      message: `Deploying ${instance.elemID.typeName} without all attached priorities for ${getInstanceAttribute(instance)}`,
      detailedMessage: `This ${instance.elemID.typeName} is attached to some ${getInstanceAttribute(instance)} that do not exist in the target environment. It will be deployed without referencing these.`,
    }))
    return { fixedElements, errors }
  }

export const policyPrioritiesHandler: WeakReferencesHandler = {
  findWeakReferences: getPolicyPriorityReferences,
  removeWeakReferences: removeMissingPriorities,
}
