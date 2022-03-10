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
import { ElemID, InstanceElement, ObjectType, toChange, Change, CORE_ANNOTATIONS, ReferenceExpression } from '@salto-io/adapter-api'
import { getChangeGroupIds } from '../src/group_change'
import { JIRA, SECURITY_LEVEL_TYPE, SECURITY_SCHEME_TYPE, WORKFLOW_TYPE_NAME } from '../src/constants'

describe('group change', () => {
  let workflowType: ObjectType
  let workflowInstance1: InstanceElement
  let workflowInstance2: InstanceElement
  let workflowInstance3: InstanceElement

  let securityLevelType: ObjectType
  let securityLevelInstance: InstanceElement
  let securitySchemeType: ObjectType
  let securitySchemeInstance: InstanceElement

  beforeEach(() => {
    workflowType = new ObjectType({ elemID: new ElemID(JIRA, WORKFLOW_TYPE_NAME) })
    workflowInstance1 = new InstanceElement('workflow1', workflowType)
    workflowInstance2 = new InstanceElement('workflow2', workflowType)
    workflowInstance3 = new InstanceElement('workflow3', workflowType)

    securityLevelType = new ObjectType({ elemID: new ElemID(JIRA, SECURITY_LEVEL_TYPE) })
    securitySchemeType = new ObjectType({ elemID: new ElemID(JIRA, SECURITY_SCHEME_TYPE) })

    securitySchemeInstance = new InstanceElement('securityScheme', securitySchemeType)
    securityLevelInstance = new InstanceElement(
      'securityLevel',
      securityLevelType,
      {},
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [
          new ReferenceExpression(securitySchemeInstance.elemID, securitySchemeInstance),
        ],
      }
    )
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

  it('should group security scheme levels', async () => {
    const changeGroupIds = await getChangeGroupIds(new Map<string, Change>([
      [securityLevelInstance.elemID.getFullName(), toChange({
        after: securityLevelInstance,
      })],
      [securitySchemeInstance.elemID.getFullName(), toChange({
        after: securitySchemeInstance,
      })],
    ]))

    expect(changeGroupIds.get(securityLevelInstance.elemID.getFullName()))
      .toBe(securitySchemeInstance.elemID.getFullName())

    expect(changeGroupIds.get(securitySchemeInstance.elemID.getFullName()))
      .toBe(securitySchemeInstance.elemID.getFullName())
  })
})
