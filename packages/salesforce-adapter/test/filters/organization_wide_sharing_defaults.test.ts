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


describe('When fetching organization-wide defaults', () => {
  const mockedFilterUtils = jest.mocked(filterUtilsModule)
  const { client, connection } = mockAdapter({})
  let filter: FilterWith<'onFetch'>

  const setDescribeSObjectsReturnValue = (fields: string[]):void => {
    const objectDefaults = {
      activateable: false,
      childRelationships: [],
      compactLayoutable: false,
      createable: false,
      custom: false,
      customSetting: false,
      deletable: false,
      deprecatedAndHidden: false,
      feedEnabled: false,
      label: 'whatever',
      labelPlural: 'whatevers',
      layoutable: false,
      mergeable: false,
      mruEnabled: false,
      namedLayoutInfos: [],
      queryable: false,
      recordTypeInfos: [],
      replicateable: false,
      retrieveable: false,
      searchable: false,
      searchLayoutable: false,
      supportedScopes: [],
      triggerable: false,
      undeletable: false,
      updateable: false,
      urls: {},
    }
    const fieldDefaults = {
      aggregatable: false,
      autoNumber: false,
      byteLength: 0,
      calculated: false,
      cascadeDelete: false,
      caseSensitive: false,
      createable: false,
      custom: false,
      defaultedOnCreate: false,
      dependentPicklist: false,
      deprecatedAndHidden: false,
      externalId: false,
      filterable: false,
      groupable: false,
      htmlFormatted: false,
      idLookup: false,
      length: 0,
      nameField: false,
      namePointing: false,
      label: 'whatever',
      nillable: false,
      permissionable: false,
      polymorphicForeignKey: false,
      queryByDistance: false,
      restrictedPicklist: false,
      scale: 1,
      searchPrefilterable: false,
      soapType: 'xsd:string',
      sortable: false,
      type: 'string',
      unique: false,
      updateable: false,
    } as const
    connection.soap.describeSObjects.mockResolvedValue([
      {
        ...objectDefaults,
        name: 'Organization',
        fields: [
          {
            ...fieldDefaults,
            name: 'name',
            nameField: true,
          },
          ...fields.map(fieldName => ({ name: fieldName, ...fieldDefaults })),
        ],
      },
    ])
  }

  beforeAll(() => {
    filter = filterCreator({
      config: { ...defaultFilterContext },
      client,
    }) as typeof filter
  })

  beforeEach(() => {
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
      SomeIrrelevantField: 'SomeIrrelevantValue',
    }])
    setDescribeSObjectsReturnValue([
      'defaultAccountAccess',
      'defaultCalendarAccess',
      'defaultCampaignAccess',
      'defaultCaseAccess',
      'defaultContactAccess',
      'defaultLeadAccess',
      'defaultOpportunityAccess',
    ])
  })

  it('should fetch them', async () => {
    const elements: Element[] = []
    await filter.onFetch(elements)
    expect(elements).toHaveLength(2)
    expect(elements).toIncludeAllPartialMembers([
      {
        elemID: new ElemID(SALESFORCE, 'Organization'),
      },
      {
        elemID: new ElemID(SALESFORCE, 'Organization', 'instance', '_config'),
        value: {
          defaultAccountAccess: 'Edit',
          defaultCalendarAccess: 'HideDetailsInsert',
          defaultCampaignAccess: 'All',
          defaultCaseAccess: 'None',
          defaultContactAccess: 'ControlledByParent',
          defaultLeadAccess: 'ReadEditTransfer',
          defaultOpportunityAccess: 'None',
          fullName: 'OrganizationSettings',
        },
      },
    ])
  })
})
