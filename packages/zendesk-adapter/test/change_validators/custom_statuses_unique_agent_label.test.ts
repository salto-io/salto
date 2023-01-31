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
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import {
  CUSTOM_STATUS_TYPE_NAME,
  ZENDESK,
} from '../../src/constants'
import { customStatusUniqueAgentLabelValidator } from '../../src/change_validators'

describe('customStatusUniqueAgentLabelValidator', () => {
  const customStatusType = new ObjectType({ elemID: new ElemID(ZENDESK, CUSTOM_STATUS_TYPE_NAME) })
  const createStatus = (category: string, label: string, id: number): InstanceElement => new InstanceElement(
    `${category}`,
    customStatusType,
    {
      id,
      status_category: category,
      raw_agent_label: label,
    }
  )
  const pending = createStatus('pending', 'a', 2)
  const solved = createStatus('solved', 'b', 4)
  const open = createStatus('open', 'c', 6)
  const hold = createStatus('hold', 'd', 8)


  it('should not return an error when all have a unique agent_label', async () => {
    const elementSource = buildElementsSourceFromElements([pending, solved, open, hold])
    const errors = await customStatusUniqueAgentLabelValidator([
      toChange({ before: pending, after: pending }),
    ], elementSource)
    expect(errors).toEqual([])
  })

  it('should return an error when the agent label already exits', async () => {
    const afterPending = pending.clone()
    afterPending.value.raw_agent_label = 'b'
    const elementSource = buildElementsSourceFromElements([afterPending, solved, open, hold])
    const errors = await customStatusUniqueAgentLabelValidator([
      toChange({ before: pending, after: afterPending }),
    ], elementSource)
    expect(errors).toEqual([
      {
        elemID: afterPending.elemID,
        severity: 'Error',
        message: 'Non unique agent label.',
        detailedMessage: `Agent label for ${afterPending.elemID.name} is already taken by another custom status.`,
      },
    ])
  })
})
