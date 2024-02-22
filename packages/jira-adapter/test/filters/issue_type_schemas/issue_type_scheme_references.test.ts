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
import 'jest-extended'
import { filterUtils } from '@salto-io/adapter-components'
import { Element, ElemID, InstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import { getFilterParams, mockClient } from '../../utils'
import issueTypeSchemeReferences from '../../../src/filters/issue_type_schemas/issue_type_scheme_references'
import { instanceCreators, mockTypes } from '../../mock_elements'

describe('issueTypeSchemeReferences', () => {
  const ISSUE_TYPES_REFERENCES = [
    new ReferenceExpression(new ElemID('Jira', 'Bug')),
    new ReferenceExpression(new ElemID('Jira', 'Task')),
    new ReferenceExpression(new ElemID('Jira', 'Feature')),
  ]
  let runFilter: (...elements: Element[]) => Promise<Element[]>
  beforeAll(async () => {
    const { client, paginator } = mockClient()
    const filter = issueTypeSchemeReferences(
      getFilterParams({
        client,
        paginator,
      }),
    ) as filterUtils.FilterWith<'onFetch'>
    runFilter = async (...elements: Element[]): Promise<Element[]> => {
      await filter.onFetch(elements)
      return elements
    }
  })

  it('should convert the value of the "issueTypeIds" field to list of references', async () => {
    const issueTypeScheme = instanceCreators.issueTypeScheme('TestScheme', ISSUE_TYPES_REFERENCES)
    const elements = await runFilter(issueTypeScheme)
    expect(elements).toEqual([issueTypeScheme])
    expect(issueTypeScheme.value.issueTypeIds).toIncludeSameMembers(ISSUE_TYPES_REFERENCES)
  })

  it('should do nothing if there are no issue types', async () => {
    const issueTypeScheme = new InstanceElement('instance', mockTypes.IssueTypeScheme, {
      name: 'inst',
    })

    const afterInstance = issueTypeScheme.clone()
    await runFilter(afterInstance)
    expect(issueTypeScheme.value).toEqual(afterInstance.value)
  })
})
