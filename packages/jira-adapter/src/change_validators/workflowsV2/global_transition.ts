/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { values } from '@salto-io/lowerdash'
import {
  ChangeValidator,
  SeverityLevel,
  getChangeData,
  isInstanceChange,
  isAdditionOrModificationChange,
} from '@salto-io/adapter-api'
import { isWorkflowV2Instance, WorkflowV2Instance } from '../../filters/workflowV2/types'

const { isDefined } = values

const getInvalidGlobalTransitions = (instance: WorkflowV2Instance): string[] => {
  const globalTransitionsSet = new Set<string>()
  const invalidGlobalTransitionsSet = new Set<string>()
  const transitions = Object.values(instance.value.transitions)

  transitions.forEach(transition => {
    const transitionType = transition.type
    if (transitionType === 'GLOBAL') {
      const transitionName = transition.name
      if (globalTransitionsSet.has(transitionName)) {
        invalidGlobalTransitionsSet.add(transitionName)
      }
      globalTransitionsSet.add(transitionName)
    }
  })

  return Array.from(invalidGlobalTransitionsSet)
}

export const globalTransitionValidator: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isWorkflowV2Instance)
    .map(instance => {
      const invalidGlobalTransitions = getInvalidGlobalTransitions(instance)
      const isInvalidGlobalTransitions = invalidGlobalTransitions.length > 0
      return isInvalidGlobalTransitions
        ? {
            elemID: instance.elemID,
            severity: 'Error' as SeverityLevel,
            message: 'Duplicated global transition name',
            detailedMessage: `Every global transition must have a unique name. To fix this, rename the following transitions to ensure they are unique: ${invalidGlobalTransitions.join(', ')}.`,
          }
        : undefined
    })
    .filter(isDefined)
