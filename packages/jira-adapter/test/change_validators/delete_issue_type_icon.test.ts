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

import {
  CORE_ANNOTATIONS,
  InstanceElement,
  ReadOnlyElementsSource,
  ReferenceExpression,
  SeverityLevel,
  toChange,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { ISSUE_TYPE_ICON_NAME, ISSUE_TYPE_NAME } from '../../src/constants'
import { createEmptyType } from '../utils'
import { deleteIssueTypeIconValidator } from '../../src/change_validators/delete_issue_type_icon'

describe('deleteIssueTypeIconValidator', () => {
  let issueTypeInstance: InstanceElement
  const issueTypeIconType = createEmptyType(ISSUE_TYPE_ICON_NAME)
  let elementsSource: ReadOnlyElementsSource
  let issueTypeIconInstance: InstanceElement
  beforeEach(async () => {
    issueTypeInstance = new InstanceElement('issueType1', createEmptyType(ISSUE_TYPE_NAME), {
      id: 1,
      name: 'issueType1',
    })
    issueTypeIconInstance = new InstanceElement(
      'issueTypeIconInstance1',
      issueTypeIconType,
      {
        id: 22,
        name: 'issueTypeIconInstance1',
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(issueTypeInstance.elemID, issueTypeInstance)],
      },
    )
  })
  it('should return error if trying delete issue type icon without its issue type', async () => {
    elementsSource = buildElementsSourceFromElements([issueTypeInstance])
    const changeErrors = await deleteIssueTypeIconValidator(
      [toChange({ before: issueTypeIconInstance })],
      elementsSource,
    )
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0]).toEqual({
      elemID: issueTypeIconInstance.elemID,
      severity: 'Error' as SeverityLevel,
      message: 'Cannot delete issue type icon without deleting the issue type itself.',
      detailedMessage:
        'Issue type icon issueTypeIconInstance1 cannot be deleted without deleting the issue type itself. Please delete the issue type first and then try again.',
    })
  })
  it('should not return error if trying to delete issue type icon with its issue type', async () => {
    elementsSource = buildElementsSourceFromElements([])
    const changeErrors = await deleteIssueTypeIconValidator(
      [toChange({ before: issueTypeIconInstance })],
      elementsSource,
    )
    expect(changeErrors).toHaveLength(0)
  })
  it('should not return error for not deleting operation', async () => {
    elementsSource = buildElementsSourceFromElements([issueTypeInstance])
    const changeErrors = await deleteIssueTypeIconValidator(
      [toChange({ after: issueTypeIconInstance })],
      elementsSource,
    )
    expect(changeErrors).toHaveLength(0)
  })
  it('should not return error for issue type icon with no parent', async () => {
    issueTypeIconInstance.annotations[CORE_ANNOTATIONS.PARENT] = undefined
    elementsSource = buildElementsSourceFromElements([issueTypeInstance])
    const changeErrors = await deleteIssueTypeIconValidator(
      [toChange({ before: issueTypeIconInstance })],
      elementsSource,
    )
    expect(changeErrors).toHaveLength(0)
  })
})
