/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { InstanceElement } from '@salto-io/adapter-api'
import { RetrieveRequest } from '@salto-io/jsforce'
import { MockInterface } from '@salto-io/test-utils'
import { FileProperties } from '@salto-io/jsforce-types'
import { collections } from '@salto-io/lowerdash'
import Connection from '../src/client/jsforce'
import SalesforceAdapter from '../src/adapter'
import mockAdapter from './adapter'
import {
  mockDescribeResult,
  mockDescribeValueResult,
  mockFileProperties,
  mockRetrieveLocator,
  mockRetrieveResult,
} from './connection'
import {
  APEX_CLASS_METADATA_TYPE,
  CUSTOM_OBJECT,
  LAYOUT_TYPE_ID_METADATA_TYPE,
  PROFILE_METADATA_TYPE,
} from '../src/constants'
import { createMockCustomObjectDescribeResult, mockFetchOpts } from './utils'
import { PACKAGE } from '../src/transformers/xml_transformer'
import { apiNameSync, isInstanceOfTypeSync, layoutObjAndName } from '../src/filters/utils'
import { ProfileSection } from '../src/types'

const { makeArray } = collections.array

describe('Profiles', () => {
  let connection: MockInterface<Connection>
  let adapter: SalesforceAdapter
  let retrieveRequests: RetrieveRequest[]

  beforeEach(() => {
    retrieveRequests = []
  })

  describe('Profiles Fetch', () => {
    const PROFILE_API_NAME = 'TestProfile'
    const FIRST_APEX_CLASS_API_NAME = 'FirstApexClass'
    const SECOND_APEX_CLASS_API_NAME = 'SecondApexClass'
    const ACCOUNT_LAYOUT_NAME = 'Account-Test Layout'
    const CONTACT_LAYOUT_NAME = 'Contact-Test Layout'
    const ACCOUNT = 'Account'
    const CONTACT = 'Contact'
    const PROFILE_RELATED_INSTANCES = [
      FIRST_APEX_CLASS_API_NAME,
      SECOND_APEX_CLASS_API_NAME,
      ACCOUNT,
      CONTACT,
      ACCOUNT_LAYOUT_NAME,
      CONTACT_LAYOUT_NAME,
    ] as const
    type ProfileRelatedInstance = (typeof PROFILE_RELATED_INSTANCES)[number]

    const isProfileRelatedInstance = (instanceApiName: string): instanceApiName is ProfileRelatedInstance =>
      PROFILE_RELATED_INSTANCES.includes(instanceApiName as ProfileRelatedInstance)

    const profileFileProps = mockFileProperties({
      fullName: PROFILE_API_NAME,
      type: PROFILE_METADATA_TYPE,
    })
    const relatedInstancesFileProps: Record<ProfileRelatedInstance, FileProperties> = {
      FirstApexClass: mockFileProperties({
        fullName: FIRST_APEX_CLASS_API_NAME,
        type: APEX_CLASS_METADATA_TYPE,
      }),
      SecondApexClass: mockFileProperties({
        fullName: SECOND_APEX_CLASS_API_NAME,
        type: APEX_CLASS_METADATA_TYPE,
      }),
      Account: mockFileProperties({
        fullName: ACCOUNT,
        type: 'CustomObject',
      }),
      Contact: mockFileProperties({
        fullName: CONTACT,
        type: 'CustomObject',
      }),
      [ACCOUNT_LAYOUT_NAME]: mockFileProperties({
        fullName: ACCOUNT_LAYOUT_NAME,
        type: 'Layout',
      }),
      [CONTACT_LAYOUT_NAME]: mockFileProperties({
        fullName: CONTACT_LAYOUT_NAME,
        type: 'Layout',
      }),
    }
    const listResultByType: Record<string, FileProperties[]> = {
      [PROFILE_METADATA_TYPE]: [profileFileProps],
      [APEX_CLASS_METADATA_TYPE]: [relatedInstancesFileProps.FirstApexClass, relatedInstancesFileProps.SecondApexClass],
      [CUSTOM_OBJECT]: [relatedInstancesFileProps.Account, relatedInstancesFileProps.Contact],
      [LAYOUT_TYPE_ID_METADATA_TYPE]: [
        relatedInstancesFileProps[ACCOUNT_LAYOUT_NAME],
        relatedInstancesFileProps[CONTACT_LAYOUT_NAME],
      ],
    }

    const relatedInstanceValueInProfile: Record<ProfileRelatedInstance, string> = {
      FirstApexClass: `<classAccesses>
          <apexClass>${FIRST_APEX_CLASS_API_NAME}</apexClass>
          <enabled>false</enabled>
        </classAccesses>`,
      SecondApexClass: `<classAccesses>
          <apexClass>${SECOND_APEX_CLASS_API_NAME}</apexClass>
          <enabled>false</enabled>
        </classAccesses>`,
      Contact: `<objectPermissions>
          <allowCreate>true</allowCreate>
          <allowDelete>true</allowDelete>
          <allowEdit>true</allowEdit>
          <allowRead>true</allowRead>
          <modifyAllRecords>true</modifyAllRecords>
          <object>${CONTACT}</object>
          <viewAllRecords>true</viewAllRecords>
        </objectPermissions>`,
      Account: `<objectPermissions>
          <allowCreate>true</allowCreate>
          <allowDelete>true</allowDelete>
          <allowEdit>true</allowEdit>
          <allowRead>true</allowRead>
          <modifyAllRecords>true</modifyAllRecords>
          <object>${ACCOUNT}</object>
          <viewAllRecords>true</viewAllRecords>
        </objectPermissions>`,
      [ACCOUNT_LAYOUT_NAME]: `<layoutAssignments>
          <layout>${ACCOUNT_LAYOUT_NAME}</layout>
          </layoutAssignments>`,
      [CONTACT_LAYOUT_NAME]: `<layoutAssignments>
          <layout>${CONTACT_LAYOUT_NAME}</layout>
          </layoutAssignments>`,
    }

    const createCustomObjectInstanceValues = (apiName: string): string =>
      `<CustomObject>
    <apiName>${apiName}</apiName>
    <actionOverrides>
        <actionName>CallHighlightAction</actionName>
        <type>Default</type>
    </actionOverrides>
    <compactLayoutAssignment>SYSTEM</compactLayoutAssignment>
    <enableFeeds>true</enableFeeds>
    <enableHistory>false</enableHistory>
    <externalSharingModel>Private</externalSharingModel>
    <fields>
        <fullName>TestField__c</fullName>
        <trackFeedHistory>false</trackFeedHistory>
    </fields>
    <listViews>
        <fullName>AllAccounts</fullName>
        <filterScope>Everything</filterScope>
        <label>All Accounts</label>
    </listViews>
    <recordTypeTrackFeedHistory>false</recordTypeTrackFeedHistory>
    <recordTypes>
        <fullName>Record_Type</fullName>
        <active>true</active>
        <label>Record Type</label>
        <picklistValues>
            <picklist>TestField__c</picklist>
            <values>
                <fullName>Other</fullName>
                <default>false</default>
            </values>
        </picklistValues>
    </recordTypes>
    <searchLayouts>
        <customTabListAdditionalFields>ACCOUNT.NAME</customTabListAdditionalFields>
    </searchLayouts>
    <sharingModel>ReadWrite</sharingModel>
    <webLinks>
        <fullName>SBQQ__Amend_Assets</fullName>
        <availability>online</availability>
        <displayType>button</displayType>
        <height>600</height>
        <linkType>page</linkType>
        <masterLabel>Amend Assets</masterLabel>
        <openType>sidebar</openType>
        <page>SBQQ__AssetSelectorAmend</page>
        <protected>false</protected>
    </webLinks>
</CustomObject>`

    const relatedInstancesValues: Record<ProfileRelatedInstance, string> = {
      FirstApexClass: `<ApexClass>
        <apiVersion>61.0</apiVersion>
        <status>Active</status>
      </ApexClass>`,
      SecondApexClass: `<ApexClass>
        <apiVersion>61.0</apiVersion>
        <status>Active</status>`,
      Account: createCustomObjectInstanceValues(ACCOUNT),
      Contact: createCustomObjectInstanceValues(CONTACT),
      [ACCOUNT_LAYOUT_NAME]: `<Layout>
        <fullName>${ACCOUNT_LAYOUT_NAME}</fullName>
        <label>${ACCOUNT_LAYOUT_NAME}</label>
        </Layout>`,
      [CONTACT_LAYOUT_NAME]: `<Layout>
        <fullName>${CONTACT_LAYOUT_NAME}</fullName>
        <label>${CONTACT_LAYOUT_NAME}</label>
        </Layout>`,
    }
    const setupMocks = ({ chunkSize = 2500, excludeProfiles = false }): void => {
      ;({ connection, adapter } = mockAdapter({
        adapterParams: {
          config: {
            maxItemsInRetrieveRequest: chunkSize,
            fetch: {
              metadata: {
                include: [{ metadataType: '.*' }],
                exclude: excludeProfiles ? [{ metadataType: PROFILE_METADATA_TYPE }] : [],
              },
            },
          },
        },
      }))
      connection.metadata.describe.mockResolvedValue(
        mockDescribeResult(Object.keys(listResultByType).map(type => ({ xmlName: type }))),
      )
      connection.metadata.list.mockImplementation(async queries =>
        makeArray(queries).flatMap(query => listResultByType[query.type] ?? []),
      )
      connection.metadata.describeValueType.mockImplementation(async type => {
        if (type.endsWith(CUSTOM_OBJECT)) {
          return createMockCustomObjectDescribeResult()
        }
        return mockDescribeValueResult({ valueTypeFields: [] })
      })
      connection.metadata.retrieve.mockImplementation(request => {
        retrieveRequests.push(request)
        const packageTypeMembers = makeArray(request?.unpackaged?.types)
        const relatedInstancesApiNames = packageTypeMembers
          .filter(type => type.name !== PROFILE_METADATA_TYPE)
          .flatMap(type => type.members) as ProfileRelatedInstance[]
        if (!relatedInstancesApiNames.every(isProfileRelatedInstance)) {
          throw new Error('Expected retrieve request to include only related instances')
        }
        const profileValues = `<Profile>
          ${relatedInstancesApiNames.map(apiName => relatedInstanceValueInProfile[apiName]).join('')}
        </Profile>
        `
        return mockRetrieveLocator(
          mockRetrieveResult({
            fileProperties: relatedInstancesApiNames
              .map(apiName => relatedInstancesFileProps[apiName])
              .concat(excludeProfiles ? [] : [profileFileProps]),
            zipFiles: relatedInstancesApiNames
              .map(apiName => ({
                path: `${PACKAGE}/${relatedInstancesFileProps[apiName].fileName}`,
                content: relatedInstancesValues[apiName],
              }))
              .concat(
                excludeProfiles ? [] : [{ path: `${PACKAGE}/${profileFileProps.fileName}`, content: profileValues }],
              ),
          }),
        )
      })
    }
    describe('when Profile is retrieved in a single chunk', () => {
      beforeEach(() => {
        setupMocks({})
      })
      it('should fetch the Profile instance and its related instances', async () => {
        const result = await adapter.fetch(mockFetchOpts)
        expect(retrieveRequests).toHaveLength(1)
        const profileInstance = result.elements.find(isInstanceOfTypeSync(PROFILE_METADATA_TYPE)) as InstanceElement
        expect(profileInstance).toBeDefined()
        expect(apiNameSync(profileInstance)).toEqual(PROFILE_API_NAME)
        expect(profileInstance.value[ProfileSection.ClassAccesses]).toEqual({
          [FIRST_APEX_CLASS_API_NAME]: { apexClass: FIRST_APEX_CLASS_API_NAME, enabled: false },
          [SECOND_APEX_CLASS_API_NAME]: { apexClass: SECOND_APEX_CLASS_API_NAME, enabled: false },
        })
        const relatedInstances = result.elements.filter(isInstanceOfTypeSync(APEX_CLASS_METADATA_TYPE))
        expect(relatedInstances).toHaveLength(2)
      })
    })
    describe('when Profile is retrieved in multiple chunks', () => {
      beforeEach(() => {
        setupMocks({ chunkSize: 2 })
      })
      it('should fetch the Profile instance and its related instances', async () => {
        const result = await adapter.fetch(mockFetchOpts)
        expect(retrieveRequests).toHaveLength(6)
        const profileInstance = result.elements.find(isInstanceOfTypeSync(PROFILE_METADATA_TYPE)) as InstanceElement
        expect(profileInstance).toBeDefined()
        expect(apiNameSync(profileInstance)).toEqual(PROFILE_API_NAME)
        expect(profileInstance.value[ProfileSection.ClassAccesses]).toEqual({
          [FIRST_APEX_CLASS_API_NAME]: { apexClass: FIRST_APEX_CLASS_API_NAME, enabled: false },
          [SECOND_APEX_CLASS_API_NAME]: { apexClass: SECOND_APEX_CLASS_API_NAME, enabled: false },
        })
        const relatedInstances = result.elements.filter(isInstanceOfTypeSync(APEX_CLASS_METADATA_TYPE))
        expect(relatedInstances).toHaveLength(2)
      })
    })
    describe('when Profile is retrieved alongside Layouts', () => {
      beforeEach(() => {
        setupMocks({ chunkSize: 2 })
      })
      it('should add the missing Layouts parents to the retrieve requests', async () => {
        await adapter.fetch(mockFetchOpts)
        const retrieveRequestsWithLayouts = retrieveRequests.filter(request =>
          request.unpackaged?.types?.some(type => type.name === LAYOUT_TYPE_ID_METADATA_TYPE),
        )
        expect(retrieveRequestsWithLayouts).not.toBeEmpty()
        const assertRetrieveRequestIncludeLayoutParents = (request: RetrieveRequest): void => {
          const expectedLayoutParents = _.uniq(
            request.unpackaged?.types
              .find(type => type.name === LAYOUT_TYPE_ID_METADATA_TYPE)
              ?.members.map(layoutName => layoutObjAndName(layoutName)[0]) ?? [],
          )
          expect(expectedLayoutParents).not.toBeEmpty()
          expect(expectedLayoutParents).toIncludeSameMembers(
            request.unpackaged?.types.find(type => type.name === CUSTOM_OBJECT)?.members ?? [],
          )
        }
        retrieveRequestsWithLayouts.forEach(assertRetrieveRequestIncludeLayoutParents)
      })
    })
    describe('when Layouts are retrieved and Profiles are excluded', () => {
      beforeEach(() => {
        setupMocks({ chunkSize: 2, excludeProfiles: true })
      })
      it('should not add the missing Layouts parents to the retrieve requests', async () => {
        await adapter.fetch(mockFetchOpts)
        const retrieveRequestsWithLayouts = retrieveRequests.filter(request =>
          request.unpackaged?.types?.some(type => type.name === LAYOUT_TYPE_ID_METADATA_TYPE),
        )
        const assertRetrieveRequestDoesNotIncludeLayoutParents = (request: RetrieveRequest): void => {
          expect(request.unpackaged?.types.find(type => type.name === CUSTOM_OBJECT)).toBeUndefined()
        }
        expect(retrieveRequestsWithLayouts).not.toBeEmpty()
        retrieveRequestsWithLayouts.forEach(assertRetrieveRequestDoesNotIncludeLayoutParents)
      })
    })
  })
})
