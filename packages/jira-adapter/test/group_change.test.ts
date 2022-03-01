/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { ElemID, InstanceElement, ObjectType, toChange, Change } from '@salto-io/adapter-api'
import { getChangeGroupIds } from '../src/group_change'
import { JIRA, WORKFLOW_TYPE_NAME } from '../src/constants'

describe('group change', () => {
  let workflowType: ObjectType
  let workflowInstance1: InstanceElement
  let workflowInstance2: InstanceElement
  let workflowInstance3: InstanceElement

  beforeEach(() => {
    workflowType = new ObjectType({ elemID: new ElemID(JIRA, WORKFLOW_TYPE_NAME) })
    workflowInstance1 = new InstanceElement('workflow1', workflowType)
    workflowInstance2 = new InstanceElement('workflow2', workflowType)
    workflowInstance3 = new InstanceElement('workflow3', workflowType)
  })

  it('should group workflow modifications', async () => {
    const changeGroupIds = await getChangeGroupIds(new Map<string, Change>([
      [workflowInstance1.elemID.getFullName(), toChange({
        before: workflowInstance1,
        after: workflowInstance1,
      })],
      [workflowInstance2.elemID.getFullName(), toChange({
        before: workflowInstance2,
        after: workflowInstance2,
      })],
      [workflowInstance3.elemID.getFullName(), toChange({ after: workflowInstance3 })],
    ]))

    expect(changeGroupIds.get(workflowInstance1.elemID.getFullName())).toBe('Workflow Modifications')
    expect(changeGroupIds.get(workflowInstance2.elemID.getFullName())).toBe('Workflow Modifications')
    expect(changeGroupIds.get(workflowInstance3.elemID.getFullName()))
      .toBe(workflowInstance3.elemID.getFullName())
  })
})
