/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { InstanceElement, toChange } from '@salto-io/adapter-api'
import { workflowType } from '../../src/autogen/types/standard_types/workflow'
import workflowAccountSpecificValidator from '../../src/change_validators/workflow_account_specific_values'
import { SCRIPT_ID } from '../../src/constants'

describe('account specific values validator for sender and recepient fields', () => {
  let instance: InstanceElement
  beforeEach(() => {
    instance = new InstanceElement(
      'instance',
      workflowType().type,
      {
        isinactive: false,
        [SCRIPT_ID]: 'customworkflow3',
        name: 'WokrflowName',
        workflowstates: {
          workflowstate: {
            workflowstate1: {
              workflowactions: {
                sendemailaction: {
                  workflowaction: {
                    recipientemail: '[STDUSERUSER]',
                    recipienttype: 'FIELD',
                    sender: '[STDUSERUSER]',
                    sendertype: 'FIELD',
                  },
                },
              },
            },
          },
        },
      }
    )
  })

  it('should not have changeError when deploying an instance without ACCOUNT_SPECIFIC_VALUES', async () => {
    const after = instance.clone()
    const changeErrors = await workflowAccountSpecificValidator(
      [toChange({ before: instance, after })]
    )
    expect(changeErrors).toHaveLength(0)
  })

  it('should have changeError when deploying an instance with sender = ACCOUNT_SPECIFIC_VALUES and sendertype = SPECIFIC', async () => {
    const after = instance.clone()
    after.value.workflowstates.workflowstate.workflowstate1.workflowactions.sendemailaction.workflowaction.sender = '[ACCOUNT_SPECIFIC_VALUE]'
    after.value.workflowstates.workflowstate.workflowstate1.workflowactions.sendemailaction.workflowaction.sendertype = 'SPECIFIC'
    const changeErrors = await workflowAccountSpecificValidator(
      [toChange({ before: instance, after })]
    )
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0].severity).toEqual('Error')
    expect(changeErrors[0].elemID).toEqual(instance.elemID)
    expect(changeErrors[0].detailedMessage).toContain('The Workflow contains a \'sender\' field with an ACCOUNT_SPECIFIC_VALUE')
  })

  it('should have changeError when deploying an instance with recipient = ACCOUNT_SPECIFIC_VALUES and recipienttype = SPECIFIC', async () => {
    const after = instance.clone()
    after.value.workflowstates.workflowstate.workflowstate1.workflowactions.sendemailaction.workflowaction.recipient = '[ACCOUNT_SPECIFIC_VALUE]'
    after.value.workflowstates.workflowstate.workflowstate1.workflowactions.sendemailaction.workflowaction.recipienttype = 'SPECIFIC'
    const changeErrors = await workflowAccountSpecificValidator(
      [toChange({ before: instance, after })]
    )
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0].severity).toEqual('Error')
    expect(changeErrors[0].elemID).toEqual(instance.elemID)
    expect(changeErrors[0].detailedMessage).toContain('The Workflow contains a \'recipient\' field with an ACCOUNT_SPECIFIC_VALUE')
  })

  it('should not throw and error when sendertype is not SPECIFIC', async () => {
    const after = instance.clone()
    after.value.sender = '[ACCOUNT_SPECIFIC_VALUE]'
    const changeErrors = await workflowAccountSpecificValidator(
      [toChange({ before: instance, after })]
    )
    expect(changeErrors).toHaveLength(0)
  })
})
