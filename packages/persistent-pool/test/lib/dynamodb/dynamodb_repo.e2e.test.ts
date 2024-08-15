/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { retry as retryUtil } from '@salto-io/lowerdash'
import { repo as makeRepo, DynamoDbInstances } from '../../../src/lib/dynamodb/dynamodb_repo'
import { Repo, Pool, Lease } from '../../../src/types'
import { MyType, myTypeName, myVal } from '../../types'
import repeat from '../../utils/repeat'
import asyncToArray from '../../utils/async_to_array'

const { retryStrategies } = retryUtil

describe('when there are existing leases', () => {
  const NUM_LEASES = 40

  if (global.dynamoEnv?.real) {
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

  const fillPool = async (): Promise<void> => {
    await Promise.all(repeat(NUM_LEASES, i => pool.register({ ...myLargeVal, intVal: i })))
    await Promise.all(repeat(NUM_LEASES, () => pool.lease(timeout)))
  }

  describe('without retries', () => {
    beforeAll(async () => {
      if (global.dynamoEnv === undefined) {
        throw new Error('no dynamo env defined')
      }
      ;({ dynamo, tableName } = global.dynamoEnv.real || global.dynamoEnv.dynalite)
      repo = await makeRepo(repoOpts())
      pool = await repo.pool(myTypeName)

      await fillPool()
    })

    describe('lease', () => {
      let lease: Lease<MyType>

      beforeEach(async () => {
        await pool.register(myVal)
        lease = (await pool.lease(timeout)) as Lease<MyType>
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

  describe('retries', () => {
    it('should throw if at limit', async () => {
      if (global.dynamoEnv === undefined) {
        throw new Error('no dynamo env defined')
      }
      ;({ dynamo, tableName } = global.dynamoEnv.real || global.dynamoEnv.dynalite)
      const repo2 = await makeRepo({
        ...repoOpts(),
        optimisticLockMaxRetries: 2,
      })
      const pool2 = await repo2.pool(myTypeName)

      try {
        await Promise.all([
          await Promise.all(repeat(NUM_LEASES, i => pool2.register({ ...myLargeVal, intVal: i }))),
          await Promise.all(repeat(NUM_LEASES, () => pool2.lease(timeout))),
        ])
      } catch (e) {
        expect((e as Error).toString()).toContain('ConditionalCheckFailedException')
      }
      return expect(pool2.waitForLease(timeout, retryStrategies.none())).resolves.not.toBeNull()
    })
  })
})
