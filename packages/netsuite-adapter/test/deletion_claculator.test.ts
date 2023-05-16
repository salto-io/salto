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
import { InstanceElement } from '@salto-io/adapter-api'
import { getDeletedElements } from '../src/deletion_calculator'
import NetsuiteClient from '../src/client/client'
import mockSdfClient from './client/sdf_client'
import SuiteAppClient from '../src/client/suiteapp_client/suiteapp_client'
import { NetsuiteQuery, ObjectID } from '../src/query'

describe('deletion calculator', () => {
  const runSuiteQLMock = jest.fn()
  const suiteAppClient = {
    runSuiteQL: runSuiteQLMock,
  } as unknown as SuiteAppClient
  const client = new NetsuiteClient(mockSdfClient(), suiteAppClient)

  const getIndexesMock = jest.fn()
  const elementsSourceIndex = {
    getIndexes: getIndexesMock,
  }

  const query = {
    isTypeMatch: () => true,
    isCustomRecordTypeMatch: () => true,
  } as unknown as NetsuiteQuery

  const serviceInstancesIds: ObjectID[] = [{ type: 'role', instanceId: '123' }]
  const serviceTargetedCustomRecords: InstanceElement[] = []

  beforeEach(async () => {
    getIndexesMock.mockReset()
  })

  it('return nothing if non relevant elements exist currently', async () => {
    getIndexesMock.mockResolvedValue({
      serviceIdRecordsIndex: {},
      internalIdsIndex: {},
    })
    const result = await getDeletedElements(
      client,
      elementsSourceIndex,
      query,
      serviceInstancesIds,
      serviceTargetedCustomRecords,
    )
    expect(result).toHaveLength(0)
  })

  // it('return nothing if non relevant elements exist currently', async () => {
  //   const result = await getDeletedElements(
  //     client,
  //     elementsSourceIndex,
  //     query,
  //     [],
  //     [],
  //   )
  //   expect(result).toHaveLength(0)
  // })
})
