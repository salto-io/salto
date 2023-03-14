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
import { toChange, ObjectType, ElemID, InstanceElement, ReferenceExpression, ReadOnlyElementsSource } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { JIRA } from '../../src/constants'
import { activeSchemeDeletionValidator } from '../../src/change_validators/active_scheme_deletion'

describe('active scheme deletion', () => {
  let workflowSchemeType: ObjectType
  let projectType: ObjectType
  let projectInstance: InstanceElement
  let workflowInstance: InstanceElement
  let elementSource: ReadOnlyElementsSource

  beforeEach(() => {
    workflowSchemeType = new ObjectType({ elemID: new ElemID(JIRA, 'WorkflowScheme') })
    projectType = new ObjectType({ elemID: new ElemID(JIRA, 'Project') })
    projectInstance = new InstanceElement(
      'instance',
      projectType,
      {
        name: 'instance',
        workflowScheme: new ReferenceExpression(new ElemID(JIRA, 'WorkflowScheme', 'instance', 'workflow')),
        issueTypeScheme: new ReferenceExpression(new ElemID(JIRA, 'IssueTypeScheme', 'instance', 'issueTypeScheme')),
      }
    )
    workflowInstance = new InstanceElement(
      'workflow',
      workflowSchemeType,
      {
        id: 'workflowid',
        name: 'instance',
      }
    )
    elementSource = buildElementsSourceFromElements([workflowInstance, projectInstance])
  })
  it('should not return error for addition/modification changes', async () => {
    const additionErrors = await activeSchemeDeletionValidator(
      [toChange({ after: workflowInstance })],
      elementSource,
    )
    expect(additionErrors).toHaveLength(0)
    const modificationErrors = await activeSchemeDeletionValidator(
      [toChange({ before: workflowInstance, after: workflowInstance })],
      elementSource,
    )
    expect(modificationErrors).toHaveLength(0)
  })
  it('should not return error for inactive scheme', async () => {
    projectInstance.value.workflowScheme = new ReferenceExpression(new ElemID(JIRA, 'WorkflowScheme', 'instance', 'workflow2'))
    const errors = await activeSchemeDeletionValidator([toChange({ before: workflowInstance })], elementSource)
    expect(errors).toHaveLength(0)
  })
  it('should return singular error for scheme linked to one project', async () => {
    const errors = await activeSchemeDeletionValidator(
      [toChange({ before: workflowInstance })],
      elementSource,
    )
    expect(errors).toHaveLength(1)
    expect(errors[0].elemID).toEqual(workflowInstance.elemID)
    expect(errors[0].detailedMessage).toEqual('This scheme is currently used by project instance, and can’t be deleted')
  })
  it('should return plural error for scheme linked to multiple projects', async () => {
    elementSource = buildElementsSourceFromElements([workflowInstance, projectInstance, projectInstance])
    const errors = await activeSchemeDeletionValidator(
      [toChange({ before: workflowInstance })],
      elementSource,
    )
    expect(errors).toHaveLength(1)
    expect(errors[0].detailedMessage).toEqual('This scheme is currently used by projects instance, instance, and can’t be deleted')
  })
})
