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
import { FileProperties } from 'jsforce'
import { MockInterface } from '@salto-io/test-utils'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { CUSTOM_OBJECT_FIELDS } from '../src/fetch_profile/metadata_types'
import { CUSTOM_FIELD, CUSTOM_OBJECT } from '../src/constants'
import { SalesforceClient } from '../index'
import Connection from '../src/client/jsforce'
import mockClient from './client'
import { mockFileProperties } from './connection'
import { getLastChangeDateOfTypesWithNestedInstances } from '../src/last_change_date_of_types_with_nested_instances'
import { buildFilePropsMetadataQuery, buildMetadataQuery } from '../src/fetch_profile/metadata_query'
import { MetadataQuery } from '../src/types'

const { makeArray } = collections.array

describe('getLastChangeDateOfTypesWithNestedInstances', () => {
  // This magic is used for fileProperties that expect to filter out.
  const FUTURE_TIME = '2024-11-07T00:00:00.000Z'
  const FIRST_OBJECT_NAME = 'Test1__c'
  const SECOND_OBJECT_NAME = 'Test2__c'
  const RELATED_TYPES = [
    ...CUSTOM_OBJECT_FIELDS,
    CUSTOM_OBJECT,
    CUSTOM_FIELD,
  ] as const
  type RelatedType = typeof RELATED_TYPES[number]
  const isRelatedType = (type: string): type is RelatedType => (
    RELATED_TYPES.includes(type as RelatedType)
  )

  let client: SalesforceClient
  let connection: MockInterface<Connection>
  let listedTypes: RelatedType[]
  let metadataQuery: MetadataQuery<FileProperties>
  beforeEach(() => {
    ({ client, connection } = mockClient())
    listedTypes = []
    const filePropByRelatedType: Record<RelatedType, FileProperties[]> = {
      BusinessProcess: [
        // Latest related property for Updated__c
        mockFileProperties({
          fullName: `${FIRST_OBJECT_NAME}.TestBusinessProcess`,
          type: 'BusinessProcess',
          lastModifiedDate: '2023-11-07T00:00:00.000Z',
        }),
        mockFileProperties({
          fullName: `${SECOND_OBJECT_NAME}.TestBusinessProcess`,
          type: 'BusinessProcess',
          lastModifiedDate: '2023-10-01T00:00:00.000Z',
        }),
        mockFileProperties({
          fullName: `${FIRST_OBJECT_NAME}.NamespacedBusinessProcess`,
          namespacePrefix: 'test',
          type: 'BusinessProcess',
          lastModifiedDate: FUTURE_TIME,
        }),
        mockFileProperties({
          fullName: `${SECOND_OBJECT_NAME}.NamespacedBusinessProcess`,
          namespacePrefix: 'test',
          type: 'BusinessProcess',
          lastModifiedDate: FUTURE_TIME,
        }),
      ],
      CompactLayout: [
        mockFileProperties({
          fullName: `${FIRST_OBJECT_NAME}.TestCompactLayout`,
          type: 'CompactLayout',
          lastModifiedDate: '2023-11-05T00:00:00.000Z',
        }),
        mockFileProperties({
          fullName: `${SECOND_OBJECT_NAME}.TestCompactLayout`,
          type: 'CompactLayout',
          lastModifiedDate: '2023-10-03T00:00:00.000Z',
        }),
      ],
      CustomField: [
        mockFileProperties({
          fullName: `${FIRST_OBJECT_NAME}.TestField__c`,
          type: CUSTOM_FIELD,
          lastModifiedDate: '2023-11-02T00:00:00.000Z',
        }),
        mockFileProperties({
          fullName: `${SECOND_OBJECT_NAME}.TestField__c`,
          type: CUSTOM_FIELD,
          lastModifiedDate: '2023-11-01T00:00:00.000Z',
        }),
      ],
      CustomObject: [
        mockFileProperties({
          fullName: FIRST_OBJECT_NAME,
          type: CUSTOM_OBJECT,
          lastModifiedDate: '2023-11-01T00:00:00.000Z',
        }),
        mockFileProperties({
          fullName: SECOND_OBJECT_NAME,
          type: CUSTOM_OBJECT,
          lastModifiedDate: '2023-11-01T00:00:00.000Z',
        }),
      ],
      FieldSet: [],
      // We exclude this type as part of the tests
      Index: [
        mockFileProperties({
          fullName: `${FIRST_OBJECT_NAME}.TestIndex`,
          type: 'Index',
          lastModifiedDate: FUTURE_TIME,
        }),
        mockFileProperties({
          fullName: `${SECOND_OBJECT_NAME}.TestIndex`,
          type: 'Index',
          lastModifiedDate: FUTURE_TIME,
        }),
      ],
      ListView: [
        mockFileProperties({
          fullName: `${FIRST_OBJECT_NAME}.TestListView`,
          type: 'ListView',
          lastModifiedDate: '2023-11-06T00:00:00.000Z',
        }),
        // Latest related property for NonUpdated__c
        mockFileProperties({
          fullName: `${SECOND_OBJECT_NAME}.TestListView`,
          type: 'ListView',
          lastModifiedDate: '2023-11-02T00:00:00.000Z',
        }),
      ],
      RecordType: [],
      SharingReason: [],
      ValidationRule: [],
      WebLink: [],
    }
    connection.metadata.list.mockImplementation(async queries => (
      makeArray(queries).flatMap(({ type }) => {
        if (!isRelatedType(type)) {
          throw new Error(`Unexpected non mocked type in mock: ${type}`)
        }
        listedTypes.push(type)
        return filePropByRelatedType[type as RelatedType] ?? []
      })
    ))
  })
  describe('when all types with nested instances are excluded', () => {
    beforeEach(() => {
      metadataQuery = buildFilePropsMetadataQuery(buildMetadataQuery({
        fetchParams: {
          metadata: {
            exclude: [{
              metadataType: CUSTOM_OBJECT,
            }],
          },
        },
      }))
    })
    it('should return empty object', async () => {
      const lastChangeDateOfTypesWithNestedInstances = await getLastChangeDateOfTypesWithNestedInstances({
        client,
        metadataQuery,
      })
      expect(lastChangeDateOfTypesWithNestedInstances).toBeEmpty()
      expect(listedTypes).toBeEmpty()
    })
  })
  describe('when all types with nested instances are included', () => {
    let excludedRelatedTypes: RelatedType[]
    beforeEach(() => {
      excludedRelatedTypes = ['Index']
      metadataQuery = buildFilePropsMetadataQuery(buildMetadataQuery({
        fetchParams: {
          metadata: {
            include: [{
              metadataType: '.*',
              namespace: '',
            }],
            exclude: excludedRelatedTypes.map(type => ({ metadataType: type })),
          },
        },
      }))
    })
    it('should return correct values', async () => {
      const lastChangeDateOfTypesWithNestedInstances = await getLastChangeDateOfTypesWithNestedInstances({
        client,
        metadataQuery,
      })
      expect(lastChangeDateOfTypesWithNestedInstances).toEqual({
        [CUSTOM_OBJECT]: {
          [FIRST_OBJECT_NAME]: '2023-11-07T00:00:00.000Z',
          [SECOND_OBJECT_NAME]: '2023-11-02T00:00:00.000Z',
        },
      })
      expect(listedTypes).toIncludeSameMembers(_.difference(RELATED_TYPES, excludedRelatedTypes))
    })
  })
})
