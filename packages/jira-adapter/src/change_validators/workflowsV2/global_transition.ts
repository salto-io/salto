/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
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
  const globalTransitionsGroupByName = _.groupBy(
    Object.values(instance.value.transitions).filter(t => t.type === 'GLOBAL'),
    'name',
  )
  const invalidTransitionsNames = Object.entries(globalTransitionsGroupByName)
    .filter(([_name, transitions]) => transitions.length > 1)
    .map(([name, _transitions]) => name)

  return invalidTransitionsNames
}

export const globalTransitionValidator: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isWorkflowV2Instance)
    .map(instance => {
      const invalidGlobalTransitions = getInvalidGlobalTransitions(instance)
      const isInvalidGlobalTransitions = !_.isEmpty(invalidGlobalTransitions)
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
