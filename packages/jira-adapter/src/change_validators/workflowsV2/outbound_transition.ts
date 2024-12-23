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
let transitionType: string
let fromStatusReferenceName: string | undefined
const { isDefined } = values
const { awu } = collections.asynciterable

const addTransitionToMap = (
  map: Map<string | ReferenceExpression, Set<string>>,
  key: string | ReferenceExpression,
  name: string,
): boolean => {
  if (map.has(key) && map.get(key)?.has(name)) {
    return false
  }
  if (!map.has(key)) {
    map.set(key, new Set<string>())
  }
  map.get(key)?.add(name)
  return true
}

const handleLinkTransitions = (
  map: Map<string | ReferenceExpression, Set<string>>,
  transitionLinks: WorkflowTransitionLinks[],
): boolean =>
  transitionLinks.every(link => {
    fromStatusReference = link?.fromStatusReference
    fromStatusReferenceName = isReferenceExpression(fromStatusReference)
      ? fromStatusReference.elemID.getFullName()
      : undefined

    return fromStatusReferenceName ? addTransitionToMap(map, fromStatusReferenceName, transitionName) : true
  })

const isValidTransitions = (instance: WorkflowV2Instance): boolean => {
  const transitionMap = new Map<string | ReferenceExpression, Set<string>>()
  const transitions = Object.values(instance.value.transitions)

  return transitions.every(transition => {
    transitionName = transition.name
    transitionType = transition.type

    if (transitionType === 'GLOBAL') {
      return addTransitionToMap(transitionMap, transitionType, transitionName)
    }
    const links = transition.links || []
    return handleLinkTransitions(transitionMap, links)
  })
}

export const outboundTransitionValidator: ChangeValidator = async changes =>
  awu(changes)
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isWorkflowV2Instance)
    .map(instance =>
      isValidTransitions(instance)
        ? undefined
        : {
            elemID: instance.elemID,
            severity: 'Error' as SeverityLevel,
            message: 'Duplicate workflow transition name',
            detailedMessage:
              'Every workflow transition (outbound or global) must have a unique name. To fix this, change the new transition name to a unique name.',
          },
    )
    .filter(isDefined)
    .toArray()
