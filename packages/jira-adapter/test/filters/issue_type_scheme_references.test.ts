/*
*                      Copyright 2021 Salto Labs Ltd.
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
import 'jest-extended'
import { filterUtils } from '@salto-io/adapter-components'
import { Element, ReferenceExpression } from '@salto-io/adapter-api'
import { getDefaultAdapterConfig, mockClient } from '../utils'
import issueTypeSchemeReferences, { isIssueTypeSchemeInstance } from '../../src/filters/issue_type_scheme_references'
import { instanceCreators } from '../mock_elements'

describe('issueTypeSchemeReferences', () => {
  const ISSUE_TYPES = [
    instanceCreators.issueType('Bug', '1'),
    instanceCreators.issueType('Task', '2'),
    instanceCreators.issueType('Feature', '3'),
  ]
  const ISSUE_TYPE_SCHEME = instanceCreators.issueTypeScheme('TestScheme', ['1', '2', '3'])

  let runFilter: (...elements: Element[]) => Promise<Element[]>
  beforeAll(async () => {
    const { client, paginator } = mockClient()
    const filter = issueTypeSchemeReferences({
      client,
      paginator,
      config: await getDefaultAdapterConfig(),
    }) as filterUtils.FilterWith<'onFetch'>
    runFilter = async (...elements: Element[]): Promise<Element[]> => {
      await filter.onFetch(elements)
      return elements
    }
  })

  it('should replace issueTypeIds with references to IssueType instances', async () => {
    const elements = await runFilter(...ISSUE_TYPES, ISSUE_TYPE_SCHEME)
    const issueTypeSchemeInstance = elements.find(isIssueTypeSchemeInstance)
    expect(issueTypeSchemeInstance?.value.issueTypes).toIncludeSameMembers([
      new ReferenceExpression(ISSUE_TYPES[0].elemID),
      new ReferenceExpression(ISSUE_TYPES[1].elemID),
      new ReferenceExpression(ISSUE_TYPES[2].elemID),
    ])
  })
})
