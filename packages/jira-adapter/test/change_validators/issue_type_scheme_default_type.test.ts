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
  toChange,
  ObjectType,
  ElemID,
  InstanceElement,
  Change,
  getChangeData,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { issueTypeSchemeDefaultTypeValidator } from '../../src/change_validators/issue_type_scheme_default_type'
import { ISSUE_TYPE_NAME, ISSUE_TYPE_SCHEMA_NAME, JIRA } from '../../src/constants'

describe('issueTypeSchemeDefaultTypeValidator', () => {
  let issueTypeSchemeChange: Change<InstanceElement>

  beforeEach(() => {
    const issueTypeSchemeType = new ObjectType({ elemID: new ElemID(JIRA, ISSUE_TYPE_SCHEMA_NAME) })

    issueTypeSchemeChange = toChange({
      after: new InstanceElement('instance', issueTypeSchemeType, {
        defaultIssueTypeId: new ReferenceExpression(new ElemID(JIRA, ISSUE_TYPE_NAME, 'instance', 'issueType1'), {}),
        issueTypeIds: [
          new ReferenceExpression(new ElemID(JIRA, ISSUE_TYPE_NAME, 'instance', 'issueType1'), {}),
          new ReferenceExpression(new ElemID(JIRA, ISSUE_TYPE_NAME, 'instance', 'issueType2'), {}),
        ],
      }),
    })
  })

  it('should return an error if the default type is not included in issueTypeIds', async () => {
    getChangeData(issueTypeSchemeChange).value.issueTypeIds = [
      new ReferenceExpression(new ElemID(JIRA, ISSUE_TYPE_NAME, 'instance', 'issueType2'), {}),
    ]
    expect(await issueTypeSchemeDefaultTypeValidator([issueTypeSchemeChange])).toEqual([
      {
        elemID: getChangeData(issueTypeSchemeChange).elemID,
        severity: 'Error',
        message: "Default issue type is not included in the scheme's types",
        detailedMessage:
          'The default issue type of an issue type scheme must be included in the issue type list of the scheme',
      },
    ])
  })

  it('should return an error if the default type is set and issueTypeIds is undefined', async () => {
    delete getChangeData(issueTypeSchemeChange).value.issueTypeIds
    expect(await issueTypeSchemeDefaultTypeValidator([issueTypeSchemeChange])).toEqual([
      {
        elemID: getChangeData(issueTypeSchemeChange).elemID,
        severity: 'Error',
        message: "Default issue type is not included in the scheme's types",
        detailedMessage:
          'The default issue type of an issue type scheme must be included in the issue type list of the scheme',
      },
    ])
  })

  it('should not return an error if the default type is included in issueTypeIds', async () => {
    expect(await issueTypeSchemeDefaultTypeValidator([issueTypeSchemeChange])).toEqual([])
  })
})
