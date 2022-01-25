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
import {
  repo as makeRepo,
  DynamoDbInstances,
} from '../../../src/lib/dynamodb/dynamodb_repo'
import {
  Repo, Pool, Lease,
} from '../../../src/types'
import { MyType, myTypeName, myVal } from '../../types'
import makeTimings, { Timings } from '../../utils/timing'
import repeat from '../../utils/repeat'
import asyncToArray from '../../utils/async_to_array'

describe('when there are existing leases', () => {
  const NUM_LEASES = 40

  if (global.dynamoEnv.real) {
    jest.setTimeout(30000)
  }

  const CLIENT_ID = 'myClient'

  let dynamo: DynamoDbInstances
  let tableName: string

  const repoOpts = (): Parameters<typeof makeRepo>[0] => ({
    clientId: CLIENT_ID,
    optimisticLockMaxRetries: NUM_LEASES,
    leaseRandomizationRange: 10,
    tableName,
    ...dynamo,
  })

  const myLargeVal: Omit<MyType, 'intVal'> = {
    arrayOfStrings: Array.from({ length: 100 }).map((_, i) => `string ${i}`),
  }

  let repo: Repo
  let pool: Pool<MyType>

  const timeout = 1000 * 60

  let timings: Timings

  const fillPool = async (): Promise<void> => {
    await Promise.all(repeat(NUM_LEASES, i => pool.register({ ...myLargeVal, intVal: i })))
    await Promise.all(repeat(NUM_LEASES, () => pool.lease(timeout)))
  }

  beforeAll(async () => {
    ({ dynamo, tableName } = global.dynamoEnv.real || global.dynamoEnv.dynalite)
    repo = await makeRepo(repoOpts())
    pool = await repo.pool(myTypeName)

    timings = makeTimings()
    timings.setup('pool', pool, 'lease')

    await fillPool()

    // eslint-disable-next-line no-console
    console.dir(timings.invocations)
  })

  afterAll(async () => {
    if (timings) timings.teardown()
  })

  describe('lease', () => {
    let lease: Lease<MyType>

    beforeEach(async () => {
      await pool.register(myVal)
      lease = await pool.lease(timeout) as Lease<MyType>
    })

    it('should return a lease', () => {
      expect(lease).not.toBeNull()
    })
  })

  describe('clear', () => {
    beforeAll(() => pool.clear())

    afterAll(fillPool, 30000)

    it('should clear the instances', async () => {
      expect(await asyncToArray(pool)).toHaveLength(0)
    })
  })
})
