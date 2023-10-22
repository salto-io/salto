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
import {
  ListTablesCommand,
} from '@aws-sdk/client-dynamodb'
import { retry } from '@salto-io/lowerdash'
import {
  repo as makeRepo,
  DynamoDbInstances,
} from '../../../src/lib/dynamodb/dynamodb_repo'
import {
  Repo, Pool, InstanceId, InstanceIdAlreadyRegistered, Lease,
  InstanceNotFoundError, InstanceNotLeasedError, LeaseWithStatus,
} from '../../../src/types'
import { testDbUtils as makeTestDbUtils } from './utils'
import { MyType, myTypeName, myVal } from '../../types'
import promiseSeries from '../../utils/promise_series'
import repeat from '../../utils/repeat'
import asyncToArray from '../../utils/async_to_array'

const { retryStrategies } = retry

describe('dynamoDB repo', () => {
  jest.setTimeout(60 * 1000)
  const CLIENT_ID = 'myClient'

  let dynamo: DynamoDbInstances
  let tableName: string
  let dbUtils: ReturnType<typeof makeTestDbUtils>

  beforeEach(async () => {
    ({ dynamo, tableName } = global.dynamoEnv.dynalite)
    dbUtils = makeTestDbUtils(dynamo.db)

    await dbUtils.deleteTable(tableName)
  })

  const repoOpts = (): Parameters<typeof makeRepo>[0] => ({
    clientId: CLIENT_ID,
    optimisticLockMaxRetries: 1,
    query: { strategy: retryStrategies.intervals({ interval: 1, maxRetries: 1 }) },
    batchDelete: {
      strategy: retryStrategies.intervals({ interval: 1, maxRetries: 1 }),
    },
    ...dynamo,
  })

  const timeout = 1000 * 60
  const suspensionReason = 'it was not being very nice'

  describe('repo', () => {
    let repo: Repo

    beforeEach(async () => {
      repo = await makeRepo(repoOpts())
    })

    it('should create the table', async () => {
      await dynamo.db.send(new ListTablesCommand({}))
      expect(await dbUtils.tableExists(tableName)).toBeTruthy()
    })

    it('should return a repo', () => {
      expect(typeof repo.pool).toBe('function')
    })

    describe('when called again', () => {
      it('should not throw', async () => {
        await makeRepo(repoOpts())
      })

      it('should return a repo', () => {
        expect(typeof repo.pool).toBe('function')
      })
    })

    describe('initialization with serviceOpts', () => {
      let pool: Pool<MyType>

      beforeEach(async () => {
        const { serviceOpts } = global.dynamoEnv.dynalite
        const repo2 = await makeRepo({ ...repoOpts(), serviceOpts })
        const pool2 = await repo2.pool(myTypeName)
        await pool2.register(myVal, 'myid')
        pool = await repo.pool(myTypeName)
      })

      it('should point to the same specified DynamoDB instance', async () => {
        expect((await pool.lease(timeout) as Lease<MyType>).id).toEqual('myid')
      })
    })
  })

  describe('pool', () => {
    let repo: Repo
    let pool: Pool<MyType>

    beforeEach(async () => {
      repo = await makeRepo(repoOpts())
      pool = await repo.pool(myTypeName)
    })

    describe('register', () => {
      let id: InstanceId

      describe('when an id is not specified', () => {
        beforeEach(async () => {
          id = await pool.register(myVal)
        })

        it('should return a new id', () => {
          expect(typeof id).toBe('string')
        })

        describe('when called again', () => {
          let id2: InstanceId

          beforeEach(async () => {
            id2 = await pool.register(myVal)
          })

          it('should return a different id', () => {
            expect(id2).not.toEqual(id)
          })
        })
      })

      describe('when an id is specified', () => {
        const specifiedId = 'id1'
        beforeEach(async () => {
          id = await pool.register(myVal, specifiedId)
        })

        it('should return a the same id', () => {
          expect(id).toEqual(specifiedId)
        })

        describe('when called again with the same id', () => {
          let result: Promise<unknown>
          beforeEach(() => {
            result = pool.register(myVal, specifiedId)
          })

          it(
            'should throw an InstanceIdAlreadyRegistered error',
            () => expect(result).rejects.toThrow(InstanceIdAlreadyRegistered)
          )

          it(
            'should throw an error with the specified id and typeName',
            () => expect(result).rejects.toMatchObject({
              id: specifiedId,
              typeName: myTypeName,
            })
          )
        })
      })
    })

    describe('unregister', () => {
      describe('when the instance is not registered', () => {
        const id = 'not-registered'
        let result: Promise<unknown>

        beforeEach(() => {
          result = pool.unregister(id)
        })

        it('should throw', () => expect(result).rejects.toThrow(InstanceNotFoundError))
      })

      describe('when the instance is registered', () => {
        let id: InstanceId

        beforeEach(async () => {
          id = await pool.register(myVal)
          await pool.unregister(id)
        })

        it('should not be available for lease', async () => {
          expect(await pool.lease(timeout)).toBeNull()
        })
      })
    })

    describe('lease', () => {
      const registeredId = 'id1'

      describe('when there are no available instances', () => {
        describe('when no retryStrategy is specified', () => {
          it('should return null', async () => {
            expect(await pool.lease(timeout)).toBeNull()
          })
        })
      })

      describe('when there is a registered instance', () => {
        let lease: Lease<MyType>
        let leaseTime: number

        beforeEach(async () => {
          await pool.register(myVal, registeredId)
          leaseTime = Date.now()
          lease = await pool.lease(timeout) as Lease<MyType>
        })

        it('should return a lease', () => {
          expect(lease).not.toBeNull()
          expect(lease).toMatchObject({ id: registeredId, value: myVal })
        })

        describe('when another lease is attempted', () => {
          describe('before the lease times out', () => {
            it('should return null', async () => {
              expect(await pool.lease(timeout)).toBeNull()
            })
          })

          describe('after the lease times out', () => {
            beforeEach(async () => {
              jest.spyOn(Date, 'now').mockImplementationOnce(() => leaseTime + timeout)
              lease = await pool.lease(timeout) as Lease<MyType>
            })

            it('should return null', async () => {
              expect(await pool.lease(timeout)).toBeNull()
            })
          })
        })
      })
    })

    describe('return', () => {
      describe('when the specified id does not exist', () => {
        const id = 'nosuchid'
        let result: Promise<unknown>
        beforeEach(() => {
          result = pool.return(id)
        })

        it(
          'should throw a InstanceNotFoundError error',
          () => expect(result).rejects.toThrow(InstanceNotFoundError)
        )

        it(
          'should throw an error with the correct message',
          () => expect(result).rejects.toThrow(
            new RegExp(`Instance "${id}" of type "${myTypeName}": not found`)
          )
        )

        it(
          'should throw an error with the specified id and typeName',
          () => expect(result).rejects.toMatchObject({
            id: 'nosuchid',
            typeName: myTypeName,
          })
        )
      })

      describe('when the instance exists', () => {
        let id: InstanceId

        beforeEach(async () => {
          id = await pool.register(myVal)
        })

        describe('when the instance is not leased', () => {
          let result: Promise<unknown>
          beforeEach(() => {
            result = pool.return(id)
          })

          it(
            'should throw a InstanceNotLeasedError error',
            () => expect(result).rejects.toThrow(InstanceNotLeasedError)
          )

          it(
            'should throw an error with the correct message',
            () => expect(result).rejects.toThrow(
              new RegExp(
                `Instance "${id}" of type "${myTypeName}": not leased by client "${CLIENT_ID}"`
              )
            )
          )

          it(
            'should throw an error with the specified id and typeName',
            () => expect(result).rejects.toMatchObject({
              id,
              typeName: myTypeName,
              clientId: CLIENT_ID,
            })
          )
        })

        describe('when the instance is leased by the another client', () => {
          let result: Promise<unknown>
          const CLIENT_ID2 = 'otherClient'
          let pool2: Pool<MyType>

          beforeEach(async () => {
            const lease = await pool.lease(timeout)
            expect(lease).not.toBeNull()
            expect(lease?.id).toEqual(id)
            const repo2 = await makeRepo({ ...repoOpts(), clientId: CLIENT_ID2 })
            pool2 = await repo2.pool(myTypeName)
          })

          describe('when validateClientId is the default true', () => {
            beforeEach(() => {
              result = pool2.return(id)
            })

            it(
              'should throw a InstanceNotLeasedError error',
              () => expect(result).rejects.toThrow(InstanceNotLeasedError)
            )

            it(
              'should throw an error with the correct message',
              () => expect(result).rejects.toThrow(
                new RegExp(
                  `Instance "${id}" of type "${myTypeName}": not leased by client "${CLIENT_ID2}"`
                )
              )
            )

            it(
              'should throw an error with the specified id and typeName',
              () => expect(result).rejects.toMatchObject({
                id,
                typeName: myTypeName,
                clientId: CLIENT_ID2,
              })
            )
          })

          describe('when validateClientId is false', () => {
            beforeEach(async () => {
              await pool2.return(id, { validateClientId: false })
            })

            it('should make the instance available for leasing again', async () => {
              const lease = await pool.lease(timeout) as Lease<MyType>
              expect(lease).not.toBeNull()
              expect(lease.id).toEqual(id)
            })
          })
        })

        describe('when the instance is leased', () => {
          beforeEach(async () => {
            await pool.lease(timeout)
            await pool.return(id)
          })

          it('should make the instance available for leasing again', async () => {
            const lease = await pool.lease(timeout) as Lease<MyType>
            expect(lease).not.toBeNull()
            expect(lease.id).toEqual(id)
          })
        })
      })
    })

    describe('updateTimeout', () => {
      describe('when the specified id does not exist', () => {
        const id = 'nosuchid'
        let result: Promise<unknown>
        beforeEach(() => {
          result = pool.updateTimeout(id, timeout)
        })

        it(
          'should throw a InstanceNotFoundError error',
          () => expect(result).rejects.toThrow(InstanceNotFoundError)
        )

        it(
          'should throw an error with the correct message',
          () => expect(result).rejects.toThrow(
            new RegExp(`Instance "${id}" of type "${myTypeName}": not found`)
          )
        )

        it(
          'should throw an error with the specified id and typeName',
          () => expect(result).rejects.toMatchObject({
            id: 'nosuchid',
            typeName: myTypeName,
          })
        )
      })

      describe('when the instance exists', () => {
        let id: InstanceId

        beforeEach(async () => {
          id = await pool.register(myVal)
        })

        describe('when the instance is not leased', () => {
          let result: Promise<unknown>
          beforeEach(() => {
            result = pool.updateTimeout(id, timeout)
          })

          it(
            'should throw a InstanceNotLeasedError error',
            () => expect(result).rejects.toThrow(InstanceNotLeasedError)
          )

          it(
            'should throw an error with the correct message',
            () => expect(result).rejects.toThrow(
              new RegExp(
                `Instance "${id}" of type "${myTypeName}": not leased by client "${CLIENT_ID}"`
              )
            )
          )

          it(
            'should throw an error with the specified id and typeName',
            () => expect(result).rejects.toMatchObject({
              id,
              typeName: myTypeName,
              clientId: CLIENT_ID,
            })
          )
        })

        describe('when the instance is leased by another client', () => {
          let result: Promise<unknown>
          const CLIENT_ID2 = 'otherClient'
          let pool2: Pool<MyType>

          beforeEach(async () => {
            const lease = await pool.lease(0)
            expect(lease).not.toBeNull()
            expect(lease?.id).toEqual(id)
            const repo2 = await makeRepo({ ...repoOpts(), clientId: CLIENT_ID2 })
            pool2 = await repo2.pool(myTypeName)
          })

          describe('when validateClientId is the default true', () => {
            beforeEach(() => {
              result = pool2.updateTimeout(id, timeout)
            })

            it(
              'should throw a InstanceNotLeasedError error',
              () => expect(result).rejects.toThrow(InstanceNotLeasedError)
            )

            it(
              'should throw an error with the correct message',
              () => expect(result).rejects.toThrow(
                new RegExp(
                  `Instance "${id}" of type "${myTypeName}": not leased by client "${CLIENT_ID2}"`
                )
              )
            )

            it(
              'should throw an error with the specified id and typeName',
              () => expect(result).rejects.toMatchObject({
                id,
                typeName: myTypeName,
                clientId: CLIENT_ID2,
              })
            )
          })

          describe('when validateClientId is false', () => {
            beforeEach(async () => {
              await pool2.updateTimeout(id, timeout, { validateClientId: false })
            })

            it('should make the instance leased again', async () => {
              const lease = await pool.lease(timeout) as Lease<MyType>
              expect(lease).toBeNull()
            })
          })
        })

        describe('when the instance is leased', () => {
          beforeEach(async () => {
            await pool.lease(0)
            await pool.updateTimeout(id, timeout)
          })

          it('should make the instance leased again', async () => {
            const lease = await pool.lease(timeout) as Lease<MyType>
            expect(lease).toBeNull()
          })
        })
      })
    })

    describe('suspend', () => {
      describe('when the specified id does not exist', () => {
        const id = 'nosuchid'
        let result: Promise<unknown>
        beforeEach(() => {
          result = pool.suspend(id, suspensionReason, timeout)
        })

        it(
          'should throw a InstanceNotFoundError error',
          () => expect(result).rejects.toThrow(InstanceNotFoundError)
        )

        it(
          'should throw an error with the correct message',
          () => expect(result).rejects.toThrow(
            new RegExp(`Instance "${id}" of type "${myTypeName}": not found`)
          )
        )

        it(
          'should throw an error with the specified id and typeName',
          () => expect(result).rejects.toMatchObject({
            id: 'nosuchid',
            typeName: myTypeName,
          })
        )
      })

      describe('when the instance exists', () => {
        let id: InstanceId

        beforeEach(async () => {
          id = await pool.register(myVal)
        })

        describe('when the instance is not leased', () => {
          beforeEach(async () => {
            await pool.suspend(id, suspensionReason, timeout, { validateClientId: false })
          })

          it('should make the instance suspended', async () => {
            const lease = await pool.lease(timeout)
            expect(lease).toBeNull()
          })
        })

        describe('when the instance is leased by another client', () => {
          let result: Promise<unknown>
          const CLIENT_ID2 = 'otherClient'
          let pool2: Pool<MyType>

          beforeEach(async () => {
            const lease = await pool.lease(0)
            expect(lease).not.toBeNull()
            expect(lease?.id).toEqual(id)
            const repo2 = await makeRepo({ ...repoOpts(), clientId: CLIENT_ID2 })
            pool2 = await repo2.pool(myTypeName)
          })

          describe('when validateClientId is the default true', () => {
            beforeEach(() => {
              result = pool2.suspend(id, suspensionReason, timeout)
            })

            it(
              'should throw a InstanceNotLeasedError error',
              () => expect(result).rejects.toThrow(InstanceNotLeasedError)
            )

            it(
              'should throw an error with the correct message',
              () => expect(result).rejects.toThrow(
                new RegExp(
                  `Instance "${id}" of type "${myTypeName}": not leased by client "${CLIENT_ID2}"`
                )
              )
            )

            it(
              'should throw an error with the specified id and typeName',
              () => expect(result).rejects.toMatchObject({
                id,
                typeName: myTypeName,
                clientId: CLIENT_ID2,
              })
            )
          })

          describe('when validateClientId is false', () => {
            beforeEach(async () => {
              await pool2.suspend(id, suspensionReason, timeout, { validateClientId: false })
            })

            it('should make the instance suspended', async () => {
              const lease = await pool.lease(timeout)
              expect(lease).toBeNull()
            })
          })
        })

        describe('when the instance is leased', () => {
          beforeEach(async () => {
            await pool.lease(timeout)
            await pool.suspend(id, suspensionReason, timeout)
          })

          it('should make the instance suspended', async () => {
            const lease = await pool.lease(timeout)
            expect(lease).toBeNull()
          })
        })
      })
    })

    describe('iteration', () => {
      let listResult: ReadonlyArray<LeaseWithStatus<MyType>>

      describe('when there are no instances', () => {
        beforeEach(async () => {
          listResult = await asyncToArray(pool)
        })

        it('should return an empty iterator', () => {
          expect(listResult).toHaveLength(0)
        })
      })

      describe('when there is an available instance', () => {
        let id: InstanceId
        let details: LeaseWithStatus<MyType>

        beforeEach(async () => {
          id = await pool.register(myVal)
          listResult = await asyncToArray(pool);
          [details] = listResult
        })

        it('should return the instance details', () => {
          expect(details).toMatchObject({
            status: 'available',
            id,
            value: myVal,
          })
        })
      })

      describe('when there is a leased instance', () => {
        let id: InstanceId
        let details: LeaseWithStatus<MyType>
        const now = Date.now()

        beforeEach(async () => {
          id = await pool.register(myVal)
          jest.spyOn(Date, 'now').mockImplementation(() => now)
          expect(await pool.lease(timeout)).not.toBeNull()
          listResult = await asyncToArray(pool);
          [details] = listResult
        })

        it('should return the instance details', () => {
          expect(details).toMatchObject({
            status: 'leased',
            id,
            value: myVal,
            clientId: CLIENT_ID,
            leaseExpiresBy: new Date(now + timeout),
          })
        })
      })

      describe('when there is a suspended instance', () => {
        let id: InstanceId
        let details: LeaseWithStatus<MyType>
        const now = Date.now()

        beforeEach(async () => {
          id = await pool.register(myVal)
          jest.spyOn(Date, 'now').mockImplementation(() => now)
          expect(await pool.lease(timeout)).not.toBeNull()
          await pool.suspend(id, suspensionReason, timeout)
          listResult = await asyncToArray(pool);
          [details] = listResult
        })

        it('should return the instance details', () => {
          expect(details).toMatchObject({
            status: 'suspended',
            id,
            value: myVal,
            clientId: CLIENT_ID,
            suspensionReason,
            leaseExpiresBy: new Date(now + timeout),
          })
        })
      })

      describe('query paging', () => {
        const listBatchSize = 2
        const numInstances = listBatchSize * 2 + 1
        const numLeased = Math.floor(numInstances / 2)

        beforeEach(async () => {
          const repo2 = await makeRepo({ ...repoOpts(), listBatchSize })
          pool = await repo2.pool(myTypeName)
          await promiseSeries(() => pool.register(myVal), numInstances)
          await promiseSeries(() => pool.lease(timeout), numLeased)
          listResult = await asyncToArray(pool)
        })

        it('should return all instances', () => {
          expect(listResult).toHaveLength(numInstances)
          expect(listResult.filter(r => r.status === 'leased')).toHaveLength(numLeased)
        })
      })
    })

    describe('clear', () => {
      const NUM_ENTRIES_OF_THIS_TYPE = 30
      beforeEach(async () => {
        await Promise.all(repeat(NUM_ENTRIES_OF_THIS_TYPE, () => pool.register(myVal)))
        expect(await asyncToArray(pool)).toHaveLength(30)
      })

      describe('when there are other typeNames in the table', () => {
        const NUM_ENTRIES_OF_OTHER_TYPE = 10
        let pool2: Pool<{}>

        const typeName2 = 'myOtherType'
        beforeEach(async () => {
          pool2 = await repo.pool(typeName2)
          await Promise.all(repeat(NUM_ENTRIES_OF_OTHER_TYPE, () => pool2.register({})))
          await pool.clear()
        })

        it('deletes all entries for the type associated with the pool', async () => {
          expect(await asyncToArray(pool)).toHaveLength(0)
        })

        it('does not delete entries for the type associated with the pool', async () => {
          expect(await asyncToArray(pool2)).toHaveLength(NUM_ENTRIES_OF_OTHER_TYPE)
        })
      })
    })
  })
})
