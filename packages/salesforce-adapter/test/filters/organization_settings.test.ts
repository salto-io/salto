/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Element, InstanceElement, isInstanceElement, isObjectType, ObjectType } from '@salto-io/adapter-api'
import { MockInterface } from '@salto-io/test-utils'
import filterCreator from '../../src/filters/organization_settings'
import mockAdapter from '../adapter'
import * as filterUtilsModule from '../../src/filters/utils'
import { CUSTOM_OBJECT_ID_FIELD, FIELD_ANNOTATIONS, ORGANIZATION_SETTINGS } from '../../src/constants'
import { createCustomObjectType, defaultFilterContext } from '../utils'
import { Types } from '../../src/transformers/transformer'
import { SalesforceClient } from '../../index'
import Connection from '../../src/client/jsforce'
import { FilterWith } from './mocks'

jest.mock('../../src/filters/utils', () => ({
  ...jest.requireActual('../../src/filters/utils'),
  queryClient: jest.fn(),
}))
const mockedFilterUtils = jest.mocked(filterUtilsModule)

describe('organization-wide defaults filter', () => {
  let client: SalesforceClient
  let connection: MockInterface<Connection>
  let filter: FilterWith<'onFetch'>

  beforeEach(() => {
    ;({ client, connection } = mockAdapter({}))
    filter = filterCreator({
      config: defaultFilterContext,
      client,
    }) as typeof filter
  })

  describe('onFetch', () => {
    const CUSTOM_OBJECT_NAME = 'CustomObject__c'
    const CUSTOM_OBJECT_WITH_LOOKUP_NAME = 'CustomObjectWithLookup__c'
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
      label: 'object',
      labelPlural: 'objects',
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

    let elements: Element[]

    beforeEach(async () => {
      mockedFilterUtils.queryClient.mockResolvedValue([
        {
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
        },
      ])
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
            ...fieldsOfInterest.map(fieldName => ({
              name: fieldName,
              ...fieldDefaults,
            })),
          ],
        },
      ])
      const customObjectType = createCustomObjectType(CUSTOM_OBJECT_NAME, {})
      const customObjectTypeWithLookup = createCustomObjectType(CUSTOM_OBJECT_WITH_LOOKUP_NAME, {
        fields: {
          LookupField__c: {
            refType: Types.primitiveDataTypes.Lookup,
            annotations: {
              [FIELD_ANNOTATIONS.REFERENCE_TO]: [CUSTOM_OBJECT_NAME],
            },
          },
          // Make sure we store unique refTo lookups in the singleton
          AnotherLookupField__c: {
            refType: Types.primitiveDataTypes.Lookup,
            annotations: {
              [FIELD_ANNOTATIONS.REFERENCE_TO]: [CUSTOM_OBJECT_NAME],
            },
          },
          MultipleRefToLookupField__c: {
            refType: Types.primitiveDataTypes.Lookup,
            annotations: {
              [FIELD_ANNOTATIONS.REFERENCE_TO]: ['Account', 'Contact'],
            },
          },
        },
      })
      elements = [customObjectType, customObjectTypeWithLookup]
      await filter.onFetch?.(elements)
    })

    it('should fetch the OrganizationSettings instance and its type', () => {
      const organizationType = elements
        .filter(isObjectType)
        .find(e => e.elemID.name === ORGANIZATION_SETTINGS) as ObjectType
      const organizationInstance = elements
        .filter(isInstanceElement)
        .find(e => e.elemID.typeName === ORGANIZATION_SETTINGS) as InstanceElement
      expect(organizationType).toBeDefined()
      expect(organizationInstance).toBeDefined()
      expect(organizationInstance.value).toEqual({
        DefaultAccountAccess: 'Edit',
        DefaultCalendarAccess: 'HideDetailsInsert',
        DefaultCampaignAccess: 'All',
        DefaultCaseAccess: 'None',
        DefaultContactAccess: 'ControlledByParent',
        DefaultLeadAccess: 'ReadEditTransfer',
        DefaultOpportunityAccess: 'None',
        LatestSupportedApiVersion: 60,
        customObjects: [CUSTOM_OBJECT_NAME, CUSTOM_OBJECT_WITH_LOOKUP_NAME],
        customObjectsLookups: {
          [CUSTOM_OBJECT_WITH_LOOKUP_NAME]: [CUSTOM_OBJECT_NAME, 'Account', 'Contact'],
        },
      })
    })
  })
})
