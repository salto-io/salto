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
import { FileProperties } from '@salto-io/jsforce'
import { MockInterface } from '@salto-io/test-utils'
import { collections } from '@salto-io/lowerdash'
import { CUSTOM_FIELD, CUSTOM_OBJECT } from '../src/constants'
import { SalesforceClient } from '../index'
import Connection from '../src/client/jsforce'
import mockClient from './client'
import { mockFileProperties } from './connection'
import { getLastChangeDateOfTypesWithNestedInstances } from '../src/last_change_date_of_types_with_nested_instances'
import {
  buildFilePropsMetadataQuery,
  buildMetadataQuery,
} from '../src/fetch_profile/metadata_query'
import {
  LastChangeDateOfTypesWithNestedInstances,
  MetadataQuery,
} from '../src/types'

const { makeArray } = collections.array

describe('getLastChangeDateOfTypesWithNestedInstances', () => {
  // This magic is used for fileProperties that expect to filter out.
  const FUTURE_TIME = '2024-11-07T00:00:00.000Z'
  const FIRST_OBJECT_NAME = 'Test1__c'
  const SECOND_OBJECT_NAME = 'Test2__c'

  let client: SalesforceClient
  let connection: MockInterface<Connection>
  let listedTypes: string[]
  let metadataQuery: MetadataQuery<FileProperties>
  beforeEach(() => {
    ;({ client, connection } = mockClient())
    listedTypes = []
    const filePropByRelatedType: Record<string, FileProperties[]> = {
      // CustomObject props
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
      // CustomLabels props
      CustomLabel: [
        mockFileProperties({
          fullName: 'TestLabel1',
          type: 'CustomLabel',
          lastModifiedDate: '2023-11-07T00:00:00.000Z',
        }),
        mockFileProperties({
          fullName: 'TestLabel2',
          type: 'CustomLabel',
          lastModifiedDate: '2023-11-09T00:00:00.000Z',
        }),
      ],
    }
    connection.metadata.list.mockImplementation(async (queries) =>
      makeArray(queries).flatMap(({ type }) => {
        listedTypes.push(type)
        return filePropByRelatedType[type] ?? []
      }),
    )
  })
  describe('when all types with nested instances are included', () => {
    let excludedRelatedTypes: string[]
    beforeEach(() => {
      excludedRelatedTypes = ['Index']
      metadataQuery = buildFilePropsMetadataQuery(
        buildMetadataQuery({
          fetchParams: {
            metadata: {
              include: [
                {
                  metadataType: '.*',
                  namespace: '',
                },
              ],
              exclude: excludedRelatedTypes.map((type) => ({
                metadataType: type,
              })),
            },
          },
        }),
      )
    })
    it('should return correct values', async () => {
      const lastChangeDateOfTypesWithNestedInstances =
        await getLastChangeDateOfTypesWithNestedInstances({
          client,
          metadataQuery,
        })
      const expected: LastChangeDateOfTypesWithNestedInstances = {
        AssignmentRules: {},
        AutoResponseRules: {},
        CustomLabels: '2023-11-09T00:00:00.000Z',
        CustomObject: {
          Test1__c: '2024-11-07T00:00:00.000Z',
          Test2__c: '2024-11-07T00:00:00.000Z',
        },
        EscalationRules: {},
        SharingRules: {},
        Workflow: {},
      }
      expect(lastChangeDateOfTypesWithNestedInstances).toEqual(expected)
    })
  })
})
