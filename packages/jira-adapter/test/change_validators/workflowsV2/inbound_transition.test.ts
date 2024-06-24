/*
 *                      Copyright 2024 Salto Labs Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { toChange, InstanceElement, ChangeDataType, Change, ReferenceExpression } from '@salto-io/adapter-api'
import { inboundTransitionChangeValidator } from '../../../src/change_validators/workflowsV2/inbound_transition'
import { STATUS_TYPE_NAME, WORKFLOW_CONFIGURATION_TYPE } from '../../../src/constants'
import { createEmptyType } from '../../utils'

describe('inboundTransitionChangeValidator', () => {
  let changes: ReadonlyArray<Change<ChangeDataType>>
  let workflowInstance: InstanceElement
  let status1: InstanceElement
  let status2: InstanceElement
  let status3: InstanceElement
  let status4: InstanceElement
  let status1Ref: ReferenceExpression
  let status2Ref: ReferenceExpression
  let status3Ref: ReferenceExpression
  let status4Ref: ReferenceExpression

  beforeEach(() => {
    const statusType = createEmptyType(STATUS_TYPE_NAME)
    status1 = new InstanceElement('status1', statusType, {
      name: 'status1',
    })
    status2 = new InstanceElement('status2', statusType, {
      name: 'status2',
    })
    status3 = new InstanceElement('status3', statusType, {
      name: 'status3',
    })
    status4 = new InstanceElement('status4', statusType, {
      name: 'status4',
    })
    status1Ref = new ReferenceExpression(status1.elemID, status1)
    status2Ref = new ReferenceExpression(status2.elemID, status2)
    status3Ref = new ReferenceExpression(status3.elemID, status3)
    status4Ref = new ReferenceExpression(status4.elemID, status4)
    workflowInstance = new InstanceElement('workflowInstance', createEmptyType(WORKFLOW_CONFIGURATION_TYPE), {
      name: 'workflowInstance',
      version: {
        versionNumber: 1,
        id: 'id',
      },
      scope: {
        project: 'project',
        type: 'type',
      },
      statuses: [
        {
          statusReference: status1Ref,
        },
        {
          statusReference: status2Ref,
        },
        {
          statusReference: status3Ref,
        },
        {
          statusReference: status4Ref,
        },
      ],
      transitions: {
        tran1: {
          name: 'tran1',
          id: 'id',
          type: 'DIRECTED',
          to: {
            statusReference: status1Ref,
          },
        },
        tran2: {
          name: 'tran1',
          id: 'id',
          type: 'DIRECTED',
        },
        tran3: {
          name: 'tran3',
          id: 'id',
          type: 'DIRECTED',
          to: {
            statusReference: status3Ref,
          },
        },
      },
    })
    changes = [toChange({ after: workflowInstance })]
  })

  it('should return an error when there are statuses without inbound transition', async () => {
    expect(await inboundTransitionChangeValidator(changes)).toEqual([
      {
        elemID: workflowInstance.elemID,
        severity: 'Error',
        message: 'Workflow statuses must have at least one inbound transition',
        detailedMessage:
          'The following statuses of workflow workflowInstance have no inbound transitions: status2, status4. To fix this, remove those statuses or add inbound transitions to them.',
      },
    ])
  })

  it('should return no error when all statuses have inbound transitions', async () => {
    workflowInstance.value.statuses.pop()
    workflowInstance.value.transitions.tran4 = {
      name: 'tran4',
      id: 'id',
      type: 'DIRECTED',
      to: {
        statusReference: status2Ref,
      },
    }
    expect(await inboundTransitionChangeValidator(changes)).toEqual([])
  })
})
