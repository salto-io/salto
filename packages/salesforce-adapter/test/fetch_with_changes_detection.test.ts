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

import { MockInterface } from '@salto-io/test-utils'
import { FileProperties, RetrieveRequest } from '@salto-io/jsforce'
import { collections } from '@salto-io/lowerdash'
import { InstanceElement } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import Connection from '../src/client/jsforce'
import SalesforceAdapter from '../index'
import mockAdapter from './adapter'
import { CUSTOM_OBJECT_FIELDS } from '../src/fetch_profile/metadata_types'
import {
  CHANGED_AT_SINGLETON,
  CUSTOM_FIELD,
  CUSTOM_OBJECT,
} from '../src/constants'
import { mockInstances, mockTypes } from './mock_elements'
import {
  mockDescribeResult,
  mockFileProperties,
  mockRetrieveLocator,
  mockRetrieveResult,
} from './connection'
import { mockFetchOpts } from './utils'
import { Types } from '../src/transformers/transformer'

const { makeArray } = collections.array

describe('Salesforce Fetch With Changes Detection', () => {
  let connection: MockInterface<Connection>
  let adapter: SalesforceAdapter
  let changedAtSingleton: InstanceElement
  beforeEach(async () => {
    changedAtSingleton = mockInstances()[CHANGED_AT_SINGLETON]
    const sourceElements = [
      ...Object.values(mockTypes),
      ...Types.getAllMissingTypes(),
      changedAtSingleton,
    ]
    const elementsSource = buildElementsSourceFromElements(sourceElements)
    ;({ connection, adapter } = mockAdapter({
      adapterParams: {
        config: {
          fetch: {
            metadata: {
              include: [
                {
                  metadataType: '.*',
                },
              ],
            },
          },
        },
        elementsSource,
      },
    }))
  })
  describe('fetch with changes detection for types with nested instances', () => {
    const RELATED_TYPES = [
      ...CUSTOM_OBJECT_FIELDS,
      CUSTOM_FIELD,
      CUSTOM_OBJECT,
    ] as const
    type RelatedType = (typeof RELATED_TYPES)[number]

    const UPDATED_OBJECT_NAME = 'Updated__c'
    const NON_UPDATED_OBJECT_NAME = 'NonUpdated__c'

    let retrieveRequest: RetrieveRequest

    beforeEach(() => {
      const filePropByRelatedType: Record<RelatedType, FileProperties[]> = {
        BusinessProcess: [
          // Latest related property for Updated__c
          mockFileProperties({
            fullName: `${UPDATED_OBJECT_NAME}.TestBusinessProcess`,
            type: 'BusinessProcess',
            lastModifiedDate: '2023-11-07T00:00:00.000Z',
          }),
          mockFileProperties({
            fullName: `${NON_UPDATED_OBJECT_NAME}.TestBusinessProcess`,
            type: 'BusinessProcess',
            lastModifiedDate: '2023-10-01T00:00:00.000Z',
          }),
        ],
        CompactLayout: [
          mockFileProperties({
            fullName: `${UPDATED_OBJECT_NAME}.TestCompactLayout`,
            type: 'CompactLayout',
            lastModifiedDate: '2023-11-05T00:00:00.000Z',
          }),
          mockFileProperties({
            fullName: `${NON_UPDATED_OBJECT_NAME}.TestCompactLayout`,
            type: 'CompactLayout',
            lastModifiedDate: '2023-10-03T00:00:00.000Z',
          }),
        ],
        CustomField: [
          mockFileProperties({
            fullName: `${UPDATED_OBJECT_NAME}.TestField__c`,
            type: CUSTOM_FIELD,
            lastModifiedDate: '2023-11-02T00:00:00.000Z',
          }),
          mockFileProperties({
            fullName: `${NON_UPDATED_OBJECT_NAME}.TestField__c`,
            type: CUSTOM_FIELD,
            lastModifiedDate: '2023-11-01T00:00:00.000Z',
          }),
        ],
        CustomObject: [
          mockFileProperties({
            fullName: UPDATED_OBJECT_NAME,
            type: CUSTOM_OBJECT,
            lastModifiedDate: '2023-11-01T00:00:00.000Z',
          }),
          mockFileProperties({
            fullName: NON_UPDATED_OBJECT_NAME,
            type: CUSTOM_OBJECT,
            lastModifiedDate: '2023-11-01T00:00:00.000Z',
          }),
        ],
        FieldSet: [],
        Index: [],
        ListView: [
          mockFileProperties({
            fullName: `${UPDATED_OBJECT_NAME}.TestListView`,
            type: 'ListView',
            lastModifiedDate: '2023-11-06T00:00:00.000Z',
          }),
          // Latest related property for NonUpdated__c
          mockFileProperties({
            fullName: `${NON_UPDATED_OBJECT_NAME}.TestListView`,
            type: 'ListView',
            lastModifiedDate: '2023-11-02T00:00:00.000Z',
          }),
        ],
        RecordType: [],
        SharingReason: [],
        ValidationRule: [],
        WebLink: [],
      }

      connection.metadata.describe.mockResolvedValue(
        mockDescribeResult(RELATED_TYPES.map((type) => ({ xmlName: type }))),
      )
      connection.metadata.list.mockImplementation(async (queries) =>
        makeArray(queries).flatMap(
          ({ type }) => filePropByRelatedType[type as RelatedType] ?? [],
        ),
      )
      connection.metadata.retrieve.mockImplementation((request) => {
        retrieveRequest = request
        return mockRetrieveLocator(mockRetrieveResult({ zipFiles: [] }))
      })

      changedAtSingleton.value[CUSTOM_OBJECT] = {
        [UPDATED_OBJECT_NAME]: '2023-11-06T00:00:00.000Z',
        [NON_UPDATED_OBJECT_NAME]: '2023-11-02T00:00:00.000Z',
      }
    })
    it('should fetch only the updated CustomObject instances', async () => {
      await adapter.fetch({ ...mockFetchOpts, withChangesDetection: true })
      expect(retrieveRequest.unpackaged?.types).toIncludeSameMembers([
        {
          name: CUSTOM_OBJECT,
          members: [UPDATED_OBJECT_NAME],
        },
      ])
    })
  })
})
