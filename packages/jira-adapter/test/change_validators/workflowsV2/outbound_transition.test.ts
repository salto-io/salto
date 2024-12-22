/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  toChange,
  InstanceElement,
  ChangeDataType,
  Change,
  SeverityLevel,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { STATUS_TYPE_NAME } from '../../../src/constants'
import { createEmptyType, createSkeletonWorkflowV2Instance, createSkeletonWorkflowV2Transition } from '../../utils'
import { outboundTransitionValidator } from '../../../src/change_validators/workflowsV2/outbound_transition'
import { WorkflowV2Transition } from '../../../src/filters/workflowV2/types'

describe('inboundTransitionChangeValidator', () => {
  let changes: ReadonlyArray<Change<ChangeDataType>>
  let workflowInstanceBefore: InstanceElement
  let workflowInstanceAfter: InstanceElement
  let transition1: WorkflowV2Transition
  let validTransition1: WorkflowV2Transition
  let invalidTransition: WorkflowV2Transition
  let validTransition2: WorkflowV2Transition
  let fromStatusReference1: ReferenceExpression
  let fromStatusReference2: ReferenceExpression
  let fromStatusReference3: ReferenceExpression
  let fromStatusReference4: ReferenceExpression
  let status1: InstanceElement
  let status2: InstanceElement
  let status3: InstanceElement
  let status4: InstanceElement

  beforeEach(() => {
    const statusType = createEmptyType(STATUS_TYPE_NAME)
    status1 = new InstanceElement('resolved', statusType, {
      name: 'jira.Status.instance.resolved',
    })
    status2 = new InstanceElement('closed', statusType, {
      name: 'jira.Status.instance.closed',
    })
    status3 = new InstanceElement('open', statusType, {
      name: 'jira.Status.instance.open',
    })
    status4 = new InstanceElement('reopened', statusType, {
      name: 'jira.Status.instance.reopened',
    })
    fromStatusReference1 = new ReferenceExpression(status1.elemID, status1)
    fromStatusReference2 = new ReferenceExpression(status2.elemID, status2)
    fromStatusReference3 = new ReferenceExpression(status3.elemID, status3)
    fromStatusReference4 = new ReferenceExpression(status4.elemID, status4)

    workflowInstanceBefore = createSkeletonWorkflowV2Instance('workflowInstanceBefore')
    workflowInstanceAfter = createSkeletonWorkflowV2Instance('workflowInstanceAfter')
    transition1 = createSkeletonWorkflowV2Transition('transition1')
    transition1.links = [
      {
        fromStatusReference: fromStatusReference1,
      },
      {
        fromStatusReference: fromStatusReference2,
      },
    ]
    validTransition1 = createSkeletonWorkflowV2Transition('transition2')
    validTransition1.links = [
      {
        fromStatusReference: fromStatusReference1,
      },
    ]
    invalidTransition = createSkeletonWorkflowV2Transition('transition1')
    invalidTransition.links = [
      {
        fromStatusReference: fromStatusReference2,
      },
    ]
    validTransition2 = createSkeletonWorkflowV2Transition('transition1')
    validTransition2.links = [
      {
        fromStatusReference: fromStatusReference3,
      },
      {
        fromStatusReference: fromStatusReference4,
      },
    ]
    workflowInstanceBefore.value.transitions = { transition1 }
    workflowInstanceAfter.value.transitions = { transition1, validTransition1, validTransition2, invalidTransition }
  })

  it('should return an error when theres an addition with duplicate outbound transition name from the same reference', async () => {
    changes = [toChange({ after: workflowInstanceAfter })]
    expect(await outboundTransitionValidator(changes)).toEqual([
      {
        elemID: workflowInstanceAfter.elemID,
        severity: 'Error' as SeverityLevel,
        message: 'Duplicate outbound workflow transition name from a status',
        detailedMessage:
          'Every outbound workflow transition from a status must have a unique name. To fix this, change the new transition name to a unique name.',
      },
    ])
  })

  it('should return an error when theres a modification with duplicate outbound transition name from the same reference', async () => {
    changes = [toChange({ before: workflowInstanceBefore, after: workflowInstanceAfter })]
    expect(await outboundTransitionValidator(changes)).toEqual([
      {
        elemID: workflowInstanceAfter.elemID,
        severity: 'Error' as SeverityLevel,
        message: 'Duplicate outbound workflow transition name from a status',
        detailedMessage:
          'Every outbound workflow transition from a status must have a unique name. To fix this, change the new transition name to a unique name.',
      },
    ])
  })
})
