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
import { toChange, ObjectType, ElemID, InstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import { statusMigrationChangeValidator } from '../../src/change_validators/status_migration'
import { JIRA } from '../../src/constants'

describe('status migration', () => {
  let type: ObjectType
  let instance: InstanceElement

  beforeEach(() => {
    type = new ObjectType({ elemID: new ElemID(JIRA, 'WorkflowScheme') })
    instance = new InstanceElement(
      'instance',
      type,
    )
  })
  it('should not return error for workflow scheme without status migration', async () => {
    const errors = await statusMigrationChangeValidator([toChange({ before: instance, after: instance })])
    expect(errors).toHaveLength(0)
  })
  it('should not return error for workflow scheme with valid status migration', async () => {
    instance.value.statusMigrations = [
      {
        issueTypeId: new ReferenceExpression(new ElemID(JIRA, 'IssueType', 'instance', 'somename')),
        statusId: new ReferenceExpression(new ElemID(JIRA, 'Status', 'instance', 'somename')),
        newStatusId: new ReferenceExpression(new ElemID(JIRA, 'Status', 'instance', 'somename')),
      },
    ]
    const errors = await statusMigrationChangeValidator([toChange({ before: instance, after: instance })])
    expect(errors).toHaveLength(0)
  })
  it('should not return error for addition/removal changes', async () => {
    instance.value.statusMigrations = [
      {
        issueTypeId: new ReferenceExpression(new ElemID(JIRA, 'IssueType', 'instance', 'somename')),
        newStatusId: new ReferenceExpression(new ElemID(JIRA, 'Status', 'instance', 'somename')),
      },
    ]
    const additionErrors = await statusMigrationChangeValidator([toChange({ after: instance })])
    expect(additionErrors).toHaveLength(0)
    const removalErrors = await statusMigrationChangeValidator([toChange({ before: instance })])
    expect(removalErrors).toHaveLength(0)
  })
  it('should return error for workflow scheme with invalid status migration', async () => {
    instance.value.statusMigrations = [
      {
        issueTypeId: new ReferenceExpression(new ElemID(JIRA, 'IssueType', 'instance', 'somename')),
        newStatusId: new ReferenceExpression(new ElemID(JIRA, 'Status', 'instance', 'somename')),
      },
    ]
    const missingFieldErrors = await statusMigrationChangeValidator([toChange({ before: instance, after: instance })])
    expect(missingFieldErrors).toHaveLength(1)
    instance.value.statusMigrations = {
      issueTypeId: new ReferenceExpression(new ElemID(JIRA, 'IssueType', 'instance', 'somename')),
      newStatusId: new ReferenceExpression(new ElemID(JIRA, 'Status', 'instance', 'somename')),
    }
    const invalidListErrors = await statusMigrationChangeValidator([toChange({ before: instance, after: instance })])
    expect(invalidListErrors).toHaveLength(1)
  })
  it('should return error for workflow scheme two of the same items', async () => {
    instance.value.statusMigrations = [
      {
        issueTypeId: new ReferenceExpression(new ElemID(JIRA, 'IssueType', 'instance', 'somename')),
        statusId: new ReferenceExpression(new ElemID(JIRA, 'Status', 'instance', 'somename')),
        newStatusId: new ReferenceExpression(new ElemID(JIRA, 'Status', 'instance', 'somename')),
      },
      {
        issueTypeId: new ReferenceExpression(new ElemID(JIRA, 'IssueType', 'instance', 'somename')),
        statusId: new ReferenceExpression(new ElemID(JIRA, 'Status', 'instance', 'somename')),
        newStatusId: new ReferenceExpression(new ElemID(JIRA, 'Status', 'instance', 'somename')),
      },
    ]
    const errors = await statusMigrationChangeValidator([toChange({ before: instance, after: instance })])
    expect(errors).toHaveLength(1)
  })
})
