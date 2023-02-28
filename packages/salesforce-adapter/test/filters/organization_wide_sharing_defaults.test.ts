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
import { CORE_ANNOTATIONS, Element, ElemID } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/organization_wide_sharing_defaults'
import mockAdapter from '../adapter'
import * as filterUtilsModule from '../../src/filters/utils'
import {
  API_NAME,
  CUSTOM_OBJECT_ID_FIELD,
  ORGANIZATION_SETTINGS,
  SALESFORCE,
} from '../../src/constants'

jest.mock('../../src/filters/utils', () => ({
  ...jest.requireActual('../../src/filters/utils'),
  queryClient: jest.fn(),
}))


describe('organization-wide defaults filter', () => {
  const mockedFilterUtils = jest.mocked(filterUtilsModule)
  const { client, connection } = mockAdapter({})
  const filter = filterCreator({
    client,
  })

  describe('onFetch', () => {
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
      const fieldsOfInterest = [
        'DefaultAccountAccess',
        'DefaultCalendarAccess',
        'DefaultCampaignAccess',
        'DefaultCaseAccess',
        'DefaultContactAccess',
        'DefaultLeadAccess',
        'DefaultOpportunityAccess',
      ]
      connection.soap.describeSObjects.mockResolvedValue([
        {
          ...objectDefaults,
          name: ORGANIZATION_SETTINGS,
          fields: [
            {
              ...fieldDefaults,
              name: 'Name',
              nameField: true,
            },
            ...fieldsOfInterest.map(fieldName => ({ name: fieldName, ...fieldDefaults })),
          ],
        },
      ])
    })

    it('should fetch them', async () => {
      const elements: Element[] = []
      await filter.onFetch(elements)
      expect(elements).toIncludeAllPartialMembers([
        {
          elemID: new ElemID(SALESFORCE, ORGANIZATION_SETTINGS),
          annotations: {
            [CORE_ANNOTATIONS.CREATABLE]: false,
            [CORE_ANNOTATIONS.DELETABLE]: false,
            [CORE_ANNOTATIONS.UPDATABLE]: false,
            [API_NAME]: ORGANIZATION_SETTINGS,
          },
        },
        {
          elemID: new ElemID(SALESFORCE, ORGANIZATION_SETTINGS, 'instance', '_config'),
          value: {
            DefaultAccountAccess: 'Edit',
            DefaultCalendarAccess: 'HideDetailsInsert',
            DefaultCampaignAccess: 'All',
            DefaultCaseAccess: 'None',
            DefaultContactAccess: 'ControlledByParent',
            DefaultLeadAccess: 'ReadEditTransfer',
            DefaultOpportunityAccess: 'None',
          },
        },
      ])
    })
  })
})
