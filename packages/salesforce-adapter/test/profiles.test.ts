/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { InstanceElement } from '@salto-io/adapter-api'
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
import { APEX_CLASS_METADATA_TYPE, PROFILE_METADATA_TYPE } from '../src/constants'
import { mockFetchOpts } from './utils'
import { PACKAGE } from '../src/transformers/xml_transformer'
import { apiNameSync, isInstanceOfTypeSync } from '../src/filters/utils'
import { ProfileSection } from '../src/types'

const { makeArray } = collections.array

describe('Profiles', () => {
  let connection: MockInterface<Connection>
  let adapter: SalesforceAdapter
  let numberOfRetrieveRequests: number

  beforeEach(() => {
    numberOfRetrieveRequests = 0
  })

  describe('Profiles Fetch', () => {
    const PROFILE_API_NAME = 'TestProfile'
    const FIRST_APEX_CLASS_API_NAME = 'FirstApexClass'
    const SECOND_APEX_CLASS_API_NAME = 'SecondApexClass'
    const PROFILE_RELATED_INSTANCES = [FIRST_APEX_CLASS_API_NAME, SECOND_APEX_CLASS_API_NAME] as const
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
    }
    const listResultByType: Record<string, FileProperties[]> = {
      [PROFILE_METADATA_TYPE]: [profileFileProps],
      [APEX_CLASS_METADATA_TYPE]: [relatedInstancesFileProps.FirstApexClass, relatedInstancesFileProps.SecondApexClass],
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
    }

    const relatedInstancesValues: Record<ProfileRelatedInstance, string> = {
      FirstApexClass: `<ApexClass>
        <apiVersion>61.0</apiVersion>
        <status>Active</status>
      </ApexClass>`,
      SecondApexClass: `<ApexClass>
        <apiVersion>61.0</apiVersion>
        <status>Active</status>`,
    }
    const setupMocks = (chunkSize = 2500): void => {
      ;({ connection, adapter } = mockAdapter({
        adapterParams: {
          config: {
            maxItemsInRetrieveRequest: chunkSize,
            fetch: {
              metadata: {
                include: [{ metadataType: '.*' }],
              },
            },
          },
        },
      }))
      connection.metadata.describe.mockResolvedValue(
        mockDescribeResult([{ xmlName: PROFILE_METADATA_TYPE }, { xmlName: APEX_CLASS_METADATA_TYPE }]),
      )
      connection.metadata.list.mockImplementation(async queries =>
        makeArray(queries).flatMap(query => listResultByType[query.type] ?? []),
      )
      connection.metadata.describeValueType.mockResolvedValue(mockDescribeValueResult({ valueTypeFields: [] }))
      connection.metadata.retrieve.mockImplementation(request => {
        numberOfRetrieveRequests += 1
        const packageTypeMembers = makeArray(request?.unpackaged?.types)
        const profileApiNames = packageTypeMembers.find(type => type.name === PROFILE_METADATA_TYPE)?.members
        if (!_.isEqual(profileApiNames, [PROFILE_API_NAME])) {
          throw new Error('Expected retrieve request to include Profile')
        }
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
              .concat(profileFileProps),
            zipFiles: relatedInstancesApiNames
              .map(apiName => ({
                path: `${PACKAGE}/${relatedInstancesFileProps[apiName].fileName}`,
                content: relatedInstancesValues[apiName],
              }))
              .concat({ path: `${PACKAGE}/${profileFileProps.fileName}`, content: profileValues }),
          }),
        )
      })
    }
    describe('when Profile is retrieved in a single chunk', () => {
      beforeEach(() => {
        setupMocks()
      })
      it('should fetch the Profile instance and its related instances', async () => {
        const result = await adapter.fetch(mockFetchOpts)
        expect(numberOfRetrieveRequests).toEqual(1)
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
        setupMocks(2)
      })
      it('should fetch the Profile instance and its related instances', async () => {
        const result = await adapter.fetch(mockFetchOpts)
        expect(numberOfRetrieveRequests).toEqual(2)
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
  })
})
