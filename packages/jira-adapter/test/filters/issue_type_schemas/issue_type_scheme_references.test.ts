/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
