/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { toChange, InstanceElement, ChangeDataType, Change } from '@salto-io/adapter-api'
import { createSkeletonWorkflowV2Instance, createSkeletonWorkflowV2Transition } from '../../utils'
import { globalTransitionValidator } from '../../../src/change_validators/workflowsV2/global_transition'
import { WorkflowV2Transition } from '../../../src/filters/workflowV2/types'

describe('inboundTransitionChangeValidator', () => {
  let changes: ReadonlyArray<Change<ChangeDataType>>
  let validWorkflowGlobalInstance: InstanceElement
  let workflowGlobalInstanceBefore: InstanceElement
  let workflowGlobalInstanceAfter: InstanceElement
  let globalTransition: WorkflowV2Transition
  let duplicatedGlobalTransition: WorkflowV2Transition
  let validGlobalTransition: WorkflowV2Transition
  let duplicatedGlobalTransition2: WorkflowV2Transition

  beforeEach(() => {
    validWorkflowGlobalInstance = createSkeletonWorkflowV2Instance('workflowGlobalInstance')
    workflowGlobalInstanceBefore = createSkeletonWorkflowV2Instance('workflowGlobalInstanceBefore')
    workflowGlobalInstanceAfter = createSkeletonWorkflowV2Instance('workflowGlobalInstanceAfter')
    globalTransition = createSkeletonWorkflowV2Transition('globalTransition')
    duplicatedGlobalTransition = createSkeletonWorkflowV2Transition('globalTransition')
    validGlobalTransition = createSkeletonWorkflowV2Transition('otherGlobalTransition')
    duplicatedGlobalTransition2 = createSkeletonWorkflowV2Transition('otherGlobalTransition')

    globalTransition.type = 'GLOBAL'
    duplicatedGlobalTransition.type = 'GLOBAL'
    validGlobalTransition.type = 'GLOBAL'
    duplicatedGlobalTransition2.type = 'GLOBAL'

    validWorkflowGlobalInstance.value.transitions = { globalTransition, validGlobalTransition }
    workflowGlobalInstanceBefore.value.transitions = { globalTransition }
    workflowGlobalInstanceAfter.value.transitions = {
      globalTransition,
      duplicatedGlobalTransition,
      validGlobalTransition,
      duplicatedGlobalTransition2,
    }
  })

  it('should not return an error when theres an addition without duplicated global transition name', async () => {
    changes = [toChange({ after: validWorkflowGlobalInstance })]
    expect(await globalTransitionValidator(changes)).toEqual([])
  })

  it('should return an error when theres an addition with a duplicated global transition name', async () => {
    changes = [toChange({ after: workflowGlobalInstanceAfter })]
    expect(await globalTransitionValidator(changes)).toEqual([
      {
        elemID: workflowGlobalInstanceAfter.elemID,
        severity: 'Error',
        message: 'Duplicated global transition name',
        detailedMessage:
          'Every global transition must have a unique name. To fix this, rename the following transitions to ensure they are unique: globalTransition, otherGlobalTransition.',
      },
    ])
  })

  it('should return an error when theres a modification with a duplicated global transition name', async () => {
    changes = [toChange({ before: workflowGlobalInstanceBefore, after: workflowGlobalInstanceAfter })]
    expect(await globalTransitionValidator(changes)).toEqual([
      {
        elemID: workflowGlobalInstanceAfter.elemID,
        severity: 'Error',
        message: 'Duplicated global transition name',
        detailedMessage:
          'Every global transition must have a unique name. To fix this, rename the following transitions to ensure they are unique: globalTransition, otherGlobalTransition.',
      },
    ])
  })

  it('should return an error when theres an addition/modification with a duplicated global transition name', async () => {
    changes = [
      toChange({ before: workflowGlobalInstanceBefore, after: workflowGlobalInstanceAfter }),
      toChange({ after: workflowGlobalInstanceAfter }),
      toChange({ after: workflowGlobalInstanceBefore }),
    ]
    expect(await globalTransitionValidator(changes)).toEqual([
      {
        elemID: workflowGlobalInstanceAfter.elemID,
        severity: 'Error',
        message: 'Duplicated global transition name',
        detailedMessage:
          'Every global transition must have a unique name. To fix this, rename the following transitions to ensure they are unique: globalTransition, otherGlobalTransition.',
      },
      {
        elemID: workflowGlobalInstanceAfter.elemID,
        severity: 'Error',
        message: 'Duplicated global transition name',
        detailedMessage:
          'Every global transition must have a unique name. To fix this, rename the following transitions to ensure they are unique: globalTransition, otherGlobalTransition.',
      },
    ])
  })
})
