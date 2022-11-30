/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { InstanceElement, ObjectType } from '@salto-io/adapter-api'
import mockAdapter from '../adapter'
import { defaultFilterContext } from '../utils'
import Connection from '../../src/client/jsforce'
import { FilterWith } from '../../src/filter'
import filterCreator from '../../src/filters/enrich_standard_objects_from_query'
import { createInstanceElement, createMetadataObjectType } from '../../src/transformers/transformer'


describe('Enrich standard objects from query filter', () => {
  let connection: MockInterface<Connection>
  let filter: FilterWith<'onFetch'>
  let entitlementProcessType: ObjectType

  beforeAll(() => {
    entitlementProcessType = createMetadataObjectType({
      annotations: {
        metadataType: 'EntitlementProcess',
        dirName: 'classes',
        suffix: 'entitlementProcess',
        hasMetaFile: true,
      },
    })
  })

  beforeEach(() => {
    const adapter = mockAdapter({})
    connection = adapter.connection
    filter = filterCreator({
      config: {
        ...defaultFilterContext,
        systemFields: ['SystemField', 'NameSystemField'],
      },
      client: adapter.client,
    }) as typeof filter
  })

  describe('onFetch', () => {
    let elements: InstanceElement[]

    beforeEach(() => {
      const mockQueryResult = {
        Name: 'Some Name',
        NameNorm: 'some name',
      }
      connection.query.mockResolvedValue({
        done: true,
        totalSize: 1,
        records: [mockQueryResult],
        nextRecordsUrl: undefined,
      })

      elements = [createInstanceElement(
        {
          fullName: 'some name',
        },
        entitlementProcessType,
      )]
    })

    it('should enrich objects', async () => {
      await filter.onFetch(elements)
      expect(elements[0].value.fullName).toEqual('Some Name')
    })
  })
})
