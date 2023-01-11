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

import { Element, ElemID } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/organization_wide_sharing_defaults'
import { FilterWith } from '../../src/filter'
import mockAdapter from '../adapter'
import { defaultFilterContext } from '../utils'
import * as filterUtilsModule from '../../src/filters/utils'
import { CUSTOM_OBJECT_ID_FIELD, SALESFORCE } from '../../src/constants'

jest.mock('../../src/filters/utils', () => ({
  ...jest.requireActual('../../src/filters/utils'),
  queryClient: jest.fn(),
}))

const mockedFilterUtils = jest.mocked(filterUtilsModule)

const setupClientMock = (): void => {
  mockedFilterUtils.queryClient.mockResolvedValue([{
    [CUSTOM_OBJECT_ID_FIELD]: 'SomeId',
    DefaultAccountAccess: 'Edit',
    DefaultContactAccess: 'ControlledByParent',
    DefaultOpportunityAccess: 'None',
    DefaultLeadAccess: 'ReadEditTransfer',
    DefaultCaseAccess: 'None',
    DefaultCalendarAccess: 'HideDetailsInsert',
    DefaultPricebookAccess: 'ReadSelect',
    DefaultCampaignAccess: 'All',
  }])
}
describe('When fetching organization-wide defaults', () => {
  let filter: FilterWith<'onFetch'>

  beforeAll(() => {
    filter = filterCreator({
      config: { ...defaultFilterContext },
      client: mockAdapter({}).client,
    }) as typeof filter
  })

  beforeEach(() => {
    setupClientMock()
  })

  it('should fetch them', async () => {
    const elements: Element[] = []
    await filter.onFetch(elements)
    expect(elements).toHaveLength(2)
    expect(elements).toIncludeAllPartialMembers([
      { elemID: new ElemID(SALESFORCE, 'Organization') },
      { elemID: new ElemID(SALESFORCE, 'Organization', 'instance', '_config') },
    ])
  })
})
