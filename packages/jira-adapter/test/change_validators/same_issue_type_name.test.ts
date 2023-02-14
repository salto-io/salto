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
import { toChange, ObjectType, ElemID, InstanceElement, ReadOnlyElementsSource } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { sameIssueTypeNameChangeValidator } from '../../src/change_validators/same_issue_type_name'
import { JIRA } from '../../src/constants'

describe('workflow scheme migration', () => {
  const issueTypeObject = new ObjectType({ elemID: new ElemID(JIRA, 'IssueType') })
  const issueTypeInstance1 = new InstanceElement('issueType1', issueTypeObject, {
    name: 'issueType1',
  })
  const issueTypeInstance2 = new InstanceElement('issueType1', issueTypeObject, {
    name: 'issueType2',
  })
  const issueTypeInstance3 = new InstanceElement('issueType1', issueTypeObject, {
    name: 'issueType3',
  })
  let elementSource: ReadOnlyElementsSource

  beforeEach(() => {
    elementSource = buildElementsSourceFromElements([issueTypeInstance1, issueTypeInstance2, issueTypeInstance3])
  })
  it('should not return error for removal changes', async () => {
    const deletionErrors = await sameIssueTypeNameChangeValidator(
      [toChange({ before: issueTypeInstance1 })],
      elementSource,
    )
    expect(deletionErrors).toHaveLength(0)
  })
  it('should not return error for unique issue type names', async () => {
    elementSource = buildElementsSourceFromElements([issueTypeInstance1, issueTypeInstance2])
    const deletionErrors = await sameIssueTypeNameChangeValidator(
      [toChange({ after: issueTypeInstance3 })],
      elementSource,
    )
    expect(deletionErrors).toHaveLength(0)
  })
  it('should return an error for same issue type names', async () => {
    const issueTypeInstance4 = new InstanceElement('issueType4', issueTypeObject, {
      name: 'issueType3',
    })
    const deletionErrors = await sameIssueTypeNameChangeValidator(
      [toChange({ after: issueTypeInstance4 })],
      elementSource,
    )
    expect(deletionErrors).toHaveLength(1)
  })
  it('should return an error for multiple changes for the same name', async () => {
    const issueTypeInstance4 = new InstanceElement('issueType4', issueTypeObject, {
      name: 'issueType3',
    })
    const issueTypeInstance5 = new InstanceElement('issueType5', issueTypeObject, {
      name: 'issueType3',
    })
    const deletionErrors = await sameIssueTypeNameChangeValidator(
      [
        toChange({ before: issueTypeInstance1, after: issueTypeInstance4 }),
        toChange({ before: issueTypeInstance2, after: issueTypeInstance5 }),
      ],
      elementSource,
    )
    expect(deletionErrors).toHaveLength(2)
  })
})
