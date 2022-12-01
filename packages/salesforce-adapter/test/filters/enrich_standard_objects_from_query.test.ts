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

import { logger } from '@salto-io/logging'
import { Element, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import mockAdapter from '../adapter'
import { defaultFilterContext } from '../utils'
import { FilterWith } from '../../src/filter'
import filterCreator from '../../src/filters/enrich_standard_objects_from_query'
import { createInstanceElement, createMetadataObjectType } from '../../src/transformers/transformer'
import SalesforceClient from '../../src/client/client'
import { SalesforceRecord } from '../../src/client/types'
import { CUSTOM_OBJECT_ID_FIELD } from '../../src/constants'

const log = logger(module)

describe('Enrich standard objects from query filter', () => {
  let client: SalesforceClient
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
    const mocks = mockAdapter({})
    client = mocks.client

    filter = filterCreator({
      config: {
        ...defaultFilterContext,
        systemFields: ['SystemField', 'NameSystemField'],
      },
      client,
    }) as typeof filter
  })

  describe('onFetch', () => {
    let testElement: Element

    const setupMocks = (): void => {
      const mockQueryResult: SalesforceRecord = {
        [CUSTOM_OBJECT_ID_FIELD]: 'SomeId',
        Name: 'Some Name',
        NameNorm: 'some name',
      }
      client.queryAll = async (_queryString: string): Promise<AsyncIterable<SalesforceRecord[]>> => (
        Promise.resolve({
          [Symbol.asyncIterator]: (): AsyncIterator<SalesforceRecord[]> => {
            let callCnt = 0
            return {
              next: () => {
                if (callCnt < 1) {
                  callCnt += 1
                  return Promise.resolve({ done: false, value: [mockQueryResult] })
                }
                return Promise.resolve({ done: true, value: undefined })
              },
            }
          },
        })
      )
    }

    beforeEach(() => {
      testElement = createInstanceElement(
        {
          fullName: 'some name',
        },
        entitlementProcessType,
      )
    })

    it('should enrich objects', async () => {
      setupMocks()
      await filter.onFetch([testElement])
      log.warn(`In the test - elements[0].fullName: ${(testElement as InstanceElement).value.fullName}`)
      expect((testElement as InstanceElement).value.fullName).toEqual('Some Name')
    })
  })
})
