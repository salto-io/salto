/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { collections, values } from '@salto-io/lowerdash'
import {
  ChangeValidator,
  SeverityLevel,
  getChangeData,
  isInstanceChange,
  isAdditionOrModificationChange,
  ReferenceExpression,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { isWorkflowV2Instance, WorkflowTransitionLinks, WorkflowV2Instance } from '../../filters/workflowV2/types'

let fromStatusReference: string | ReferenceExpression | undefined
let transitionName: string
let links: WorkflowTransitionLinks[]
let fromStatusReferenceName: string | undefined
const { isDefined } = values
const { awu } = collections.asynciterable

const validateDuplicateTransitions = (instance: WorkflowV2Instance): boolean => {
  const transitionMap = new Map<string | ReferenceExpression, Set<string>>()
  const transitions = Object.values(instance.value.transitions)

  const validChanges = transitions.every(transition => {
    transitionName = transition.name
    links = transition.links || []
    return links.every(link => {
      fromStatusReference = link?.fromStatusReference
      fromStatusReferenceName = isReferenceExpression(fromStatusReference)
        ? fromStatusReference.elemID.getFullName()
        : undefined
      if (fromStatusReferenceName) {
        if (
          transitionMap.has(fromStatusReferenceName) &&
          transitionMap.get(fromStatusReferenceName)?.has(transitionName)
        ) {
          return false
        }
        if (!transitionMap.has(fromStatusReferenceName)) {
          transitionMap.set(fromStatusReferenceName, new Set<string>())
        }
        transitionMap.get(fromStatusReferenceName)?.add(transitionName)
      }
      return true
    })
  })

  return validChanges
}

export const outboundTransitionValidator: ChangeValidator = async changes =>
  awu(changes)
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isWorkflowV2Instance)
    .map(instance => {
      const isValidChanges = validateDuplicateTransitions(instance)
      return isValidChanges
        ? undefined
        : {
            elemID: instance.elemID,
            severity: 'Error' as SeverityLevel,
            message: 'Duplicate outbound workflow transition name from a status',
            detailedMessage:
              'Every outbound workflow transition from a status must have a unique name. To fix this, change the new transition name to a unique name.',
          }
    })
    .filter(isDefined)
    .toArray()
