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
  SeverityLevel,
} from '@salto-io/adapter-api'
import { invertNaclCase } from '@salto-io/adapter-utils'
import { TRANSITION_PARTS_SEPARATOR } from '../../filters/workflow/transition_structure'
import { isWorkflowInstance } from '../../filters/workflowV2/types'

const isDuplicateTransitionKey = (transitionKey: string): boolean =>
  !Number.isNaN(Number(invertNaclCase(transitionKey).split(TRANSITION_PARTS_SEPARATOR).pop()))

export const workflowTransitionDuplicateNameValidator: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isWorkflowInstance)
    .filter(
      workflow =>
        workflow.value.transitions !== undefined &&
        Object.keys(workflow.value.transitions).some(isDuplicateTransitionKey),
    )
    .map(instance => {
      const duplicateTransitions = Array.from(
        new Set(
          Object.keys(instance.value.transitions)
            .filter(isDuplicateTransitionKey)
            .map(transitionKey => invertNaclCase(transitionKey).split(TRANSITION_PARTS_SEPARATOR)[0]),
        ),
      ).join(', ')
      return {
        elemID: instance.elemID,
        severity: 'Error' as SeverityLevel,
        message: 'Workflow transitions must be unique',
        detailedMessage: `A workflow with the name "${instance.value.name}" has transitions that cannot be distinguished by name, type and origin, and cannot be deployed.
The transitions names are ${duplicateTransitions}.
Change the name of the transitions to be unique.`,
      }
    })
