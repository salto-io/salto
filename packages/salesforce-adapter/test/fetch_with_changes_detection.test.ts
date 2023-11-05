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

import { MockInterface } from '@salto-io/test-utils'
import { FileProperties } from 'jsforce'
import { collections } from '@salto-io/lowerdash'
import { InstanceElement } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { awu } from '@salto-io/lowerdash/dist/src/collections/asynciterable'
import Connection from '../src/client/jsforce'
import SalesforceAdapter from '../index'
import mockAdapter from './adapter'
import { CUSTOM_OBJECT_FIELDS } from '../src/fetch_profile/metadata_types'
import { CHANGED_AT_SINGLETON, CUSTOM_FIELD, CUSTOM_OBJECT } from '../src/constants'
import { mockInstances, mockTypes } from './mock_elements'
import { mockFileProperties, mockRetrieveLocator, mockRetrieveResult } from './connection'
import { mockFetchOpts } from './utils'
import { Types } from '../src/transformers/transformer'

const { makeArray } = collections.array

describe('Salesforce Fetch With Changes Detection', () => {
  const OBJECT_NAME = 'Test__c'
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
    const elementsSource = buildElementsSourceFromElements(sourceElements);
    ({ connection, adapter } = mockAdapter({
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
    const elements = await awu(await elementsSource.getAll()).toArray()
    console.log(elements)
  })
  describe('fetch with changes detection for CustomObjects', () => {
    const RELATED_TYPES = [...CUSTOM_OBJECT_FIELDS, CUSTOM_FIELD, CUSTOM_OBJECT] as const
    type RelatedType = typeof RELATED_TYPES[number]

    let retrieveRequest: FileProperties[]

    beforeEach(() => {
      const filePropByRelatedType: Record<RelatedType, FileProperties[]> = {
        BusinessProcess: [],
        CompactLayout: [],
        CustomField: [mockFileProperties({
          fullName: `${OBJECT_NAME}.TestField__c`,
          type: CUSTOM_FIELD,
          lastModifiedDate: '2023-11-02T00:00:00.000Z',
        })],
        CustomObject: [mockFileProperties({
          fullName: OBJECT_NAME,
          type: CUSTOM_OBJECT,
          lastModifiedDate: '2023-11-01T00:00:00.000Z',
        })],
        FieldSet: [],
        Index: [],
        ListView: [],
        RecordType: [],
        SharingReason: [],
        ValidationRule: [],
        WebLink: [],
      }
      connection.metadata.list.mockImplementation(async queries => (
        makeArray(queries).flatMap(({ type }) => filePropByRelatedType[type as RelatedType] ?? [])
      ))
      connection.metadata.retrieve.mockImplementation(request => {
        console.log(request)
        return mockRetrieveLocator(mockRetrieveResult({ zipFiles: [] }))
      })
    })
    describe('when none of the related Elements were changed', () => {
      beforeEach(() => {
        changedAtSingleton.value[CUSTOM_OBJECT] = {
          [OBJECT_NAME]: '2023-11-01T00:00:00.000Z',
        }
      })
      it('should not fetch the CustomObject instance', async () => {
        await adapter.fetch({ ...mockFetchOpts, withChangesDetection: true })
      })
    })
  })
})
